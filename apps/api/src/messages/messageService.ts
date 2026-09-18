import type { Message, Prisma } from '@prisma/client';
import type { DetectedLanguage, MessageDTO, SenderType } from '@stemcare/shared';
import { prisma } from '../db';
import { conflict } from '../common/errors';
import { lockRoom } from '../chatRooms/roomLock';
import { toMessageDTO, type Viewer } from './messageMapper';

export interface CreateMessageInput {
  chatRoomId: string;
  senderType: SenderType;
  senderId?: string | null;
  text: string;
  originalLanguage?: DetectedLanguage;
  translatedLanguage?: string | null;
  translatedText?: string | null;
  visibleText?: string;
  translationStatus?: string;
  clientMessageId?: string | null;
  viewer?: Viewer;
}

/**
 * 메시지를 저장하고 상담방의 lastMessageAt 을 함께 갱신한 뒤, DB row 를 그대로 돌려준다.
 *
 * HTTP 라우트와 소켓 핸들러가 모두 이 함수 하나만 거친다 — 저장 로직이 두 곳에
 * 나뉘면 반드시 어긋난다. 소켓 브로드캐스트는 고객용/운영자용 DTO 를 각각
 * 새로 만들어야 하므로 DTO 가 아니라 row 가 필요해서 이 함수를 따로 둔다.
 * `createMessage` 는 이 함수에 `toMessageDTO` 하나만 얹은 얇은 래퍼다.
 */
export async function createMessageRow(input: CreateMessageInput, tx?: Prisma.TransactionClient): Promise<Message> {
  if (!tx) return prisma.$transaction(transaction => createMessageRow(input, transaction));
  const room = await lockRoom(tx, input.chatRoomId);
  if (room.status === 'closed' && input.senderType !== 'system') {
    throw conflict('ROOM_CLOSED', '종료된 상담입니다. 새 상담을 시작해주세요.');
  }
  if (input.clientMessageId) {
    const existing = await tx.message.findUnique({ where: {
      chatRoomId_clientMessageId: { chatRoomId: input.chatRoomId, clientMessageId: input.clientMessageId }
    } });
    if (existing) {
      if (existing.senderType !== input.senderType || existing.senderId !== (input.senderId ?? null)) {
        throw conflict('MESSAGE_ID_CONFLICT', '다른 발신자가 사용한 메시지 ID입니다.');
      }
      return existing;
    }
  }
  const message = await tx.message.create({ data: {
    chatRoomId: input.chatRoomId,
    senderType: input.senderType,
    senderId: input.senderId ?? null,
    messageType: input.senderType === 'system' ? 'system' : 'text',
    originalLanguage: input.originalLanguage ?? 'unknown',
    originalText: input.text,
    translatedLanguage: input.translatedLanguage ?? null,
    translatedText: input.translatedText ?? null,
    visibleText: input.visibleText ?? input.text,
    translationStatus: input.translationStatus ?? 'none',
    clientMessageId: input.clientMessageId ?? null,
    // DB now()는 트랜잭션 시작 시각이므로 잠금 대기 이후의 실제 저장 시각을 쓴다.
    createdAt: new Date(Math.max(Date.now(), (room.lastMessageAt?.getTime() ?? 0) + 1, (room.operatorLastReadAt?.getTime() ?? 0) + 1))
  } });
  await tx.chatRoom.update({ where: { id: room.id }, data: { lastMessageAt: message.createdAt } });
  return message;
}

export async function createMessage(input: CreateMessageInput, tx?: Prisma.TransactionClient): Promise<MessageDTO> {
  const row = await createMessageRow(input, tx);
  return toMessageDTO(row, input.viewer ?? 'operator');
}

export async function listMessages(chatRoomId: string, viewer: Viewer, db: Prisma.TransactionClient = prisma): Promise<MessageDTO[]> {
  const rows = await db.message.findMany({
    where: { chatRoomId },
    orderBy: { createdAt: 'asc' }
  });
  return rows.map((row) => toMessageDTO(row, viewer));
}

/** 새 저장 여부도 같은 방 잠금 안에서 판단한다. HTTP/소켓 동시 재시도에 공통 적용. */
export async function createMessageResult(input: CreateMessageInput): Promise<{ row: Message; created: boolean }> {
  return prisma.$transaction(async tx => {
    await lockRoom(tx, input.chatRoomId);
    const existing = input.clientMessageId ? await tx.message.findUnique({ where: {
      chatRoomId_clientMessageId: { chatRoomId: input.chatRoomId, clientMessageId: input.clientMessageId }
    } }) : null;
    const row = await createMessageRow(input, tx);
    return { row, created: !existing };
  });
}
