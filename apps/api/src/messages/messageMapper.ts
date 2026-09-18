import type { Message } from '@prisma/client';
import type {
  DetectedLanguage,
  Language,
  MessageDTO,
  MessageType,
  SenderType,
  TranslationStatus
} from '@stemcare/shared';

export type Viewer = 'customer' | 'operator';

/**
 * 같은 메시지라도 고객과 운영자에게 다르게 보인다.
 * - 고객: 자기 언어로 볼 문장 하나만 필요하다. (visibleText)
 * - 운영자: 원문과 번역문을 모두 봐야 한다.
 */
export function toMessageDTO(row: Message, viewer: Viewer): MessageDTO {
  const base: MessageDTO = {
    id: row.id,
    chatRoomId: row.chatRoomId,
    senderType: row.senderType as SenderType,
    senderId: row.senderId,
    messageType: row.messageType as MessageType,
    originalLanguage: row.originalLanguage as DetectedLanguage,
    originalText: row.originalText,
    translatedLanguage: row.translatedLanguage as Language | null,
    translatedText: row.translatedText,
    visibleText: row.visibleText,
    translationStatus: row.translationStatus as TranslationStatus,
    clientMessageId: row.clientMessageId,
    createdAt: row.createdAt.toISOString()
  };

  if (viewer === 'operator') {
    return base;
  }

  // 고객에게는 운영자 내부용 번역 정보를 숨긴다.
  // 본인이 보낸 메시지는 자기가 쓴 원문 그대로 보여준다.
  const isOwnMessage = row.senderType === 'customer';
  return {
    ...base,
    originalText: isOwnMessage ? row.originalText : row.visibleText,
    translatedText: null,
    translatedLanguage: null,
    translationStatus: 'none'
  };
}
