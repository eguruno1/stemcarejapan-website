import type { Prisma } from '@prisma/client';
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
 * 메시지를 저장하고 상담방의 lastMessageAt 을 함께 갱신한다.
 * 두 작업을 트랜잭션으로 묶어야 "메시지는 저장됐는데 목록에는 안 뜨는" 상태가 생기지 않는다.
 */
export async function createMessage(input: CreateMessageInput, tx?: Prisma.TransactionClient): Promise<MessageDTO> {
  if (!tx) return prisma.$transaction(transaction => createMessage(input, transaction));
  const room = await lockRoom(tx, input.chatRoomId);
  const viewer = input.viewer ?? 'operator';
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
      return toMessageDTO(existing, viewer);
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
  return toMessageDTO(message, viewer);
}

export async function listMessages(chatRoomId: string, viewer: Viewer, db: Prisma.TransactionClient = prisma): Promise<MessageDTO[]> {
  const rows = await db.message.findMany({
    where: { chatRoomId },
    orderBy: { createdAt: 'asc' }
  });
  return rows.map((row) => toMessageDTO(row, viewer));
}
