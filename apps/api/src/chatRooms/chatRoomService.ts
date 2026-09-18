import type { ChatRoom, Message, Prisma } from '@prisma/client';
import type {
  ChatRoomDetail,
  ChatRoomListItem,
  ChatRoomStatus,
  CustomerHistoryItem,
  Language,
  ServiceType,
  StartChatRequest,
  StartChatResponse
} from '@stemcare/shared';
import { lockRoom } from './roomLock';
import { conflict, forbidden, notFound, unauthorized } from '../common/errors';
import { prisma } from '../db';
import { createVisitorToken, hashVisitorToken } from '../auth/token';
import { createMessage, createMessageRow, listMessages } from '../messages/messageService';
import { toChatRoomListItem, toCustomerDTO, type RoomWithRelations } from './chatRoomMapper';

/**
 * AI 호출 없이 고정 문구로 만든다. 첫 인사는 매번 다를 필요가 없고, API 키가
 * 없거나 장애일 때도 반드시 나가야 한다. 가입 폼에 적은 문의(firstMessage)에
 * 대한 개별 답변은 만들지 않는다 - 이 인사말 자체가 "문의 감사합니다, 방문
 * 시기와 인원을 알려주세요"로 응답을 유도한다.
 */
const GREETINGS: Record<Language, string> = {
  ko: [
    '안녕하세요, StemCareJapan 상담입니다.',
    '문의해 주셔서 감사합니다. 방문 예정 시기와 인원을 알려주시면 안내가 더 정확해집니다.',
    '정확한 비용과 예약 가능 여부는 담당자가 확인 후 안내드립니다.'
  ].join('\n'),
  ja: [
    'こんにちは。StemCareJapan の相談窓口です。',
    'お問い合わせありがとうございます。ご訪問予定の時期と人数をお知らせいただけますと、より正確にご案内できます。',
    '正確な費用やご予約の可否は担当者が確認のうえご案内いたします。'
  ].join('\n')
};

export interface StartChatResult extends StartChatResponse {
  /** HTTP 라우트가 방송에 쓴다. 공개 응답 바디에는 포함하지 않는다. */
  greeting: Message;
}

export async function startChat(input: StartChatRequest): Promise<StartChatResult> {
  const visitorToken = createVisitorToken();

  const { customer, room, greeting } = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: {
        name: input.name.trim(),
        phone: input.phone.trim(),
        email: input.email?.trim() || null,
        preferredLanguage: input.preferredLanguage,
        serviceType: input.serviceType,
        privacyAgreedAt: new Date()
      }
    });

    const room = await tx.chatRoom.create({
      data: {
        customerId: customer.id,
        serviceType: input.serviceType,
        status: 'bot',
        sourcePage: input.sourcePage ?? null,
        visitorTokenHash: hashVisitorToken(visitorToken)
      }
    });

    const firstMessage = input.message?.trim();
    if (firstMessage) {
      await createMessage({
        chatRoomId: room.id, senderType: 'customer', senderId: customer.id,
        text: firstMessage, originalLanguage: input.preferredLanguage, viewer: 'customer'
      }, tx);
    }

    // AI 첫 인사는 항상 남긴다. (외부 API 에 의존하지 않는다) 문의 뒤에 저장해
    // 인사가 항상 마지막 메시지가 되게 한다 - runBotTurn 은 "마지막이 고객
    // 메시지일 때만" 답하므로, 이렇게 하면 가입 폼의 문의에 곧바로 AI 가
    // 다시 끼어들지 않는다.
    const greeting = await createMessageRow({
      chatRoomId: room.id,
      senderType: 'ai',
      text: GREETINGS[input.preferredLanguage],
      visibleText: GREETINGS[input.preferredLanguage],
      originalLanguage: input.preferredLanguage
    }, tx);

    return { customer, room, greeting };
  });

  return {
    roomId: room.id,
    customerId: customer.id,
    visitorToken,
    status: room.status as ChatRoomStatus,
    greeting
  };
}

/** 고객 요청에서 상담방 소유권을 확인한다. 통과하면 상담방 row 를 돌려준다. */
export async function authorizeVisitor(roomId: string, visitorToken: string | undefined): Promise<ChatRoom> {
  if (!visitorToken) {
    throw unauthorized('상담방 접근 토큰이 없습니다.');
  }

  const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
  if (!room) {
    throw notFound('상담방을 찾을 수 없습니다.');
  }

  if (room.visitorTokenHash !== hashVisitorToken(visitorToken)) {
    throw forbidden('이 상담방에 접근할 권한이 없습니다.');
  }

  return room;
}

export function assertRoomOpen(room: ChatRoom): void {
  if (room.status === 'closed') {
    throw conflict('ROOM_CLOSED', '종료된 상담입니다. 새 상담을 시작해주세요.');
  }
}

/* ---------- 운영자용 목록/상세 (Task 7) ---------- */

export interface ListRoomsFilter {
  status?: ChatRoomStatus;
  assignedOperatorId?: string;
  sort?: 'recent' | 'oldest_waiting';
}

export async function listRooms(filter: ListRoomsFilter = {}): Promise<ChatRoomListItem[]> {
  const rooms = (await prisma.chatRoom.findMany({
    where: {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.assignedOperatorId ? { assignedOperatorId: filter.assignedOperatorId } : {})
    },
    include: {
      customer: true,
      assignedOperator: true,
      // 마지막 메시지 한 건만 미리보기용으로 가져온다.
      messages: { orderBy: { createdAt: 'desc' }, take: 1 }
    },
    orderBy:
      filter.sort === 'oldest_waiting'
        ? [{ lastMessageAt: 'asc' }, { createdAt: 'asc' }]
        : [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }]
  })) as RoomWithRelations[];

  if (rooms.length === 0) return [];

  // 안 읽은 메시지를 방마다 count 로 세면 N+1 쿼리가 된다.
  // 운영자가 마지막으로 읽은 시각이 방마다 다르므로, groupBy 로 한 번에 셀 수는 없다.
  // 대신 고객 메시지만 한 번에 끌어와 메모리에서 센다. (방당 최대 수백 건 수준)
  const customerMessages = await prisma.message.findMany({
    where: { chatRoomId: { in: rooms.map((room) => room.id) }, senderType: 'customer' },
    select: { chatRoomId: true, createdAt: true }
  });

  const unreadByRoom = new Map<string, number>();
  for (const room of rooms) {
    const since = room.operatorLastReadAt;
    const unread = customerMessages.filter(
      (m) => m.chatRoomId === room.id && (since === null || m.createdAt > since)
    ).length;
    unreadByRoom.set(room.id, unread);
  }

  return rooms.map((room) => toChatRoomListItem(room, unreadByRoom.get(room.id) ?? 0));
}

export async function getRoomDetail(roomId: string, db: Prisma.TransactionClient = prisma): Promise<ChatRoomDetail> {
  const room = await db.chatRoom.findUnique({
    where: { id: roomId },
    include: {
      customer: true,
      summaries: { orderBy: { createdAt: 'desc' }, take: 1 },
      notes: { orderBy: { createdAt: 'desc' }, include: { operator: true } }
    }
  });

  if (!room) {
    throw notFound('상담방을 찾을 수 없습니다.');
  }

  const messages = await listMessages(room.id, 'operator', db);
  const latestSummary = room.summaries[0] ?? null;

  return {
    id: room.id,
    status: room.status as ChatRoomStatus,
    serviceType: room.serviceType as ServiceType,
    sourcePage: room.sourcePage,
    assignedOperatorId: room.assignedOperatorId,
    createdAt: room.createdAt.toISOString(),
    closedAt: room.closedAt?.toISOString() ?? null,
    customer: toCustomerDTO(room.customer),
    messages,
    summary: latestSummary
      ? {
          id: latestSummary.id,
          summary: latestSummary.summary,
          customerNeeds: latestSummary.customerNeeds,
          nextAction: latestSummary.nextAction,
          riskFlags: latestSummary.riskFlags,
          createdAt: latestSummary.createdAt.toISOString()
        }
      : null,
    notes: room.notes.map((note) => ({
      id: note.id,
      operatorId: note.operatorId,
      operatorName: note.operator.name,
      note: note.note,
      createdAt: note.createdAt.toISOString()
    }))
  };
}

/** 상세 조회와 읽음 처리가 새 메시지 저장과 엇갈리지 않도록 같은 잠금을 쓴다. */
export async function getRoomDetailAndMarkRead(roomId: string): Promise<ChatRoomDetail> {
  return prisma.$transaction(async tx => {
    const room = await lockRoom(tx, roomId);
    const detail = await getRoomDetail(roomId, tx);
    await tx.chatRoom.update({ where: { id: roomId }, data: {
      operatorLastReadAt: new Date(Math.max(Date.now(), room.lastMessageAt?.getTime() ?? 0))
    } });
    return detail;
  });
}

/* ---------- 배정과 상태 변경 (Task 8) ---------- */

/**
 * 배정 성공 시 만들어진 시스템 안내 메시지를 함께 돌려준다.
 * (실시간 브로드캐스트는 이 함수가 아니라 호출부인 HTTP 라우터가 한다 — 아래 설명 참고)
 *
 * chatRoomService.ts 는 realtime/socketServer.ts 를 import 하지 않는다.
 * chatEvents.ts(소켓)가 chatRoomService.ts 를 이미 쓰고 있어서, 거꾸로 이 파일이
 * getIo() 를 가져오면 순환 참조가 생긴다. 그래서 "무엇이 바뀌었는지"만 돌려주고,
 * 소켓으로 알릴지 말지는 항상 호출부(HTTP 라우터 / 소켓 핸들러)가 결정한다.
 */
export async function assignRoom(
  roomId: string,
  operatorId: string
): Promise<{ room: ChatRoomDetail; notice: Message | null }> {
  const notice = await prisma.$transaction(async tx => {
    const room = await lockRoom(tx, roomId);
    if (room.assignedOperatorId && room.assignedOperatorId !== operatorId) {
      throw conflict('ALREADY_ASSIGNED', '다른 운영자가 이미 담당 중인 상담입니다.');
    }
    const isNewAssignment = room.assignedOperatorId !== operatorId;
    await tx.chatRoom.update({ where: { id: roomId }, data: {
      assignedOperatorId: operatorId, status: 'active', closedAt: null
    } });
    if (!isNewAssignment) return null;
    return createMessageRow({ chatRoomId: roomId, senderType: 'system',
      text: '운영자가 상담에 참여했습니다.', originalLanguage: 'ko' }, tx);
  });

  return { room: await getRoomDetail(roomId), notice };
}

export async function updateRoomStatus(
  roomId: string,
  status: ChatRoomStatus,
  operatorId: string
): Promise<{ room: ChatRoomDetail; notice: Message | null }> {
  const notice = await prisma.$transaction(async tx => {
    const room = await lockRoom(tx, roomId);
    if (room.status === status) return null;
    await tx.chatRoom.update({ where: { id: roomId }, data: {
      status,
      closedAt: status === 'closed' ? new Date() : null,
      assignedOperatorId: status === 'active' ? (room.assignedOperatorId ?? operatorId) : room.assignedOperatorId
    } });
    if (status !== 'closed') return null;
    return createMessageRow({ chatRoomId: roomId, senderType: 'system',
      text: '상담이 종료되었습니다.', originalLanguage: 'ko' }, tx);
  });

  return { room: await getRoomDetail(roomId), notice };
}

/**
 * 고객이 "담당자 연결 요청"을 눌렀을 때. AI 상담(bot) 중일 때만 대기(waiting)로
 * 올린다 — 이미 대기·진행 중인 방에서 다시 눌러도 안내 메시지가 반복되지 않는다.
 * (동일 상태 재요청은 기존 메시지를 유지한다는 이 API 전체의 원칙과 같다)
 */
export async function requestHandoff(
  roomId: string
): Promise<{ status: ChatRoomStatus; assignedOperatorId: string | null; notice: Message | null }> {
  return prisma.$transaction(async tx => {
    const room = await lockRoom(tx, roomId);
    if (room.status === 'closed') {
      throw conflict('ROOM_CLOSED', '종료된 상담입니다. 새 상담을 시작해주세요.');
    }
    if (room.status !== 'bot') {
      return { status: room.status as ChatRoomStatus, assignedOperatorId: room.assignedOperatorId, notice: null };
    }
    await tx.chatRoom.update({ where: { id: roomId }, data: { status: 'waiting' } });
    const notice = await createMessageRow({
      chatRoomId: roomId,
      senderType: 'system',
      text: '담당자 연결을 요청했습니다. 잠시만 기다려주세요.',
      originalLanguage: 'ko'
    }, tx);
    return { status: 'waiting' as ChatRoomStatus, assignedOperatorId: room.assignedOperatorId, notice };
  });
}

/**
 * 이 고객의 지난 상담 목록.
 * 지금 보고 있는 상담방은 제외한다. (오른쪽 패널에 자기 자신이 또 나오면 혼란스럽다)
 */
export async function listCustomerHistory(
  customerId: string,
  excludeRoomId: string
): Promise<CustomerHistoryItem[]> {
  const rooms = await prisma.chatRoom.findMany({
    where: { customerId, id: { not: excludeRoomId } },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      // 메시지를 전부 가져오지 않고 DB 에서 COUNT(*) 로 센다.
      _count: { select: { messages: true } }
    }
  });

  return rooms.map((room) => ({
    roomId: room.id,
    status: room.status as ChatRoomStatus,
    serviceType: room.serviceType as ServiceType,
    startedAt: room.createdAt.toISOString(),
    closedAt: room.closedAt?.toISOString() ?? null,
    messageCount: room._count.messages
  }));
}

/** 전달한 메시지까지만 읽음으로 확정한다. 지연된 방송이 미래 메시지를 읽지 않는다. */
export async function markDeliveredRead(roomId: string, deliveredAt: Date): Promise<void> {
  await prisma.$transaction(async tx => {
    const room = await lockRoom(tx, roomId);
    if (!room.operatorLastReadAt || room.operatorLastReadAt < deliveredAt) {
      await tx.chatRoom.update({ where: { id: roomId }, data: { operatorLastReadAt: deliveredAt } });
    }
  });
}
