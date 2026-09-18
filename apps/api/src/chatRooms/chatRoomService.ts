import type { ChatRoom } from '@prisma/client';
import type {
  ChatRoomDetail,
  ChatRoomListItem,
  ChatRoomStatus,
  ServiceType,
  StartChatRequest,
  StartChatResponse
} from '@stemcare/shared';
import { conflict, forbidden, notFound, unauthorized } from '../common/errors';
import { prisma } from '../db';
import { createVisitorToken, hashVisitorToken } from '../auth/token';
import { createMessage, listMessages } from '../messages/messageService';
import { toChatRoomListItem, toCustomerDTO, type RoomWithRelations } from './chatRoomMapper';

export async function startChat(input: StartChatRequest): Promise<StartChatResponse> {
  const visitorToken = createVisitorToken();

  const { customer, room } = await prisma.$transaction(async (tx) => {
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

    return { customer, room };
  });

  const firstMessage = input.message?.trim();
  if (firstMessage) {
    await createMessage({
      chatRoomId: room.id,
      senderType: 'customer',
      senderId: customer.id,
      text: firstMessage,
      // 언어 감지는 Phase 5 에서 붙인다. 지금은 고객이 고른 언어를 그대로 쓴다.
      originalLanguage: input.preferredLanguage,
      viewer: 'customer'
    });
  }

  return {
    roomId: room.id,
    customerId: customer.id,
    visitorToken,
    status: room.status as ChatRoomStatus
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
        : [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }]
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

export async function getRoomDetail(roomId: string): Promise<ChatRoomDetail> {
  const room = await prisma.chatRoom.findUnique({
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

  const messages = await listMessages(room.id, 'operator');
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

/** 운영자가 방을 열면 "여기까지 읽었다"를 기록한다. */
export async function markRoomRead(roomId: string): Promise<void> {
  await prisma.chatRoom.update({
    where: { id: roomId },
    data: { operatorLastReadAt: new Date() }
  });
}
