import { Prisma } from '@prisma/client';
import type { DetectedLanguage, MessageDTO, SenderType } from '@stemcare/shared';
import { prisma } from '../db';
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
export async function createMessage(input: CreateMessageInput): Promise<MessageDTO> {
  const viewer: Viewer = input.viewer ?? 'operator';
  const visibleText = input.visibleText ?? input.text;

  try {
    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: {
          chatRoomId: input.chatRoomId,
          senderType: input.senderType,
          senderId: input.senderId ?? null,
          messageType: 'text',
          originalLanguage: input.originalLanguage ?? 'unknown',
          originalText: input.text,
          translatedLanguage: input.translatedLanguage ?? null,
          translatedText: input.translatedText ?? null,
          visibleText,
          translationStatus: input.translationStatus ?? 'none',
          clientMessageId: input.clientMessageId ?? null
        }
      }),
      prisma.chatRoom.update({
        where: { id: input.chatRoomId },
        data: { lastMessageAt: new Date() }
      })
    ]);

    return toMessageDTO(message, viewer);
  } catch (err) {
    // P2002 = unique 제약 위반. (chatRoomId, clientMessageId) 중복 = 재전송이다.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && input.clientMessageId) {
      const existing = await prisma.message.findFirstOrThrow({
        where: { chatRoomId: input.chatRoomId, clientMessageId: input.clientMessageId }
      });
      return toMessageDTO(existing, viewer);
    }
    throw err;
  }
}

export async function listMessages(chatRoomId: string, viewer: Viewer): Promise<MessageDTO[]> {
  const rows = await prisma.message.findMany({
    where: { chatRoomId },
    orderBy: { createdAt: 'asc' }
  });
  return rows.map((row) => toMessageDTO(row, viewer));
}
