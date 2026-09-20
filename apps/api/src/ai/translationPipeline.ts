import { lockRoom } from '../chatRooms/roomLock';
import { getChatSettings, lockChatConfiguration } from '../settings/chatSettings';
import type { DetectedLanguage, Language } from '@stemcare/shared';
import type { Server } from 'socket.io';
import { prisma } from '../db';
import { logError } from '../common/logger';
import { broadcastMessageUpdate } from '../realtime/emitters';
import { detectLanguage, resolveLanguage } from './languageDetector';
import { translate } from './translator';

/**
 * 이 서비스의 운영자는 한국 기반이며 한국어로 읽는다(운영자가 답변을 쓸 언어는
 * ChatComposer 에서 직접 고르지만, 고객이 보낸 원문을 "누가 읽을지"는 항상
 * 운영자이고 그 대상 언어는 고정이다). 그래서 고객→운영자 방향의 번역 대상은
 * oppositeLanguage(source) 가 아니라 항상 'ko' 다 — 한국어 고객의 한국어 메시지는
 * source===target('ko') 이 되어 애초에 번역할 게 없다.
 */
const OPERATOR_LANGUAGE: Language = 'ko';

/**
 * 메시지 한 건을 번역해서 DB에 채워 넣고, 결과를 소켓으로 알린다.
 *
 * 설계 원칙:
 * - 이 함수는 절대 예외를 던지지 않는다. 호출부가 await 하지 않아도(void 로 불러도) 안전해야 한다.
 * - 원문은 이미 저장·전달된 뒤에 호출된다. 여기서 실패해도 상담은 계속된다.
 * - io 가 null 이면 (테스트 등) DB만 갱신한다.
 */
async function translateMessage(
  io: Server | null,
  messageId: string
): Promise<void> {
  try {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { chatRoom: { include: { customer: true } } }
    });

    if (!message || !message.chatRoom.translationEnabled) return;
    const settings = await getChatSettings();
    if (!settings.translationEnabled) return;

    // 이 파이프라인은 고객 원문을 운영자 한국어로 번역하는 경로다.
    if (message.senderType !== 'customer') return;

    // 이미 번역이 붙어 있으면 (운영자가 미리보기로 번역해 보낸 경우) 건너뛴다.
    if (message.translationStatus === 'done' || message.translationStatus === 'edited') return;

    const customerLanguage = message.chatRoom.customer.preferredLanguage as Language;
    const stored = message.originalLanguage as DetectedLanguage;
    const detected = detectLanguage(message.originalText);
    const source = resolveLanguage(detected, stored === 'unknown' ? customerLanguage : stored);
    const target = OPERATOR_LANGUAGE;

    // 이미 한국어면 번역할 게 없다. (한국어 고객의 한국어 메시지가 이 경우다)
    if (source === target) {
      await prisma.message.update({ where: { id: messageId }, data: { originalLanguage: source, translationStatus: 'none' } });
      return;
    }

    await prisma.message.update({
      where: { id: messageId },
      data: { originalLanguage: source, translationStatus: 'pending' }
    });

    const result = await translate({ text: message.originalText, source, target });

    const updated = await prisma.$transaction(async tx => {
      await lockChatConfiguration(tx);
      const current = await getChatSettings(tx);
      const room = await lockRoom(tx, message.chatRoomId);
      if (current.revision !== settings.revision || !room.translationEnabled || room.translationRevision !== message.chatRoom.translationRevision) {
        return tx.message.update({ where: { id: messageId }, data: { translationStatus: 'none' } });
      }
      return tx.message.update({
        where: { id: messageId },
        data: result.status === 'done'
          ? { translatedLanguage: target, translatedText: result.text, translationStatus: 'done' }
          : result.status === 'skipped' ? { translationStatus: 'none' }
          : { translationStatus: 'failed', translatedText: null }
      });
    });

    if (io) await broadcastMessageUpdate(io, message.chatRoomId, updated);
  } catch (err) {
    // 백그라운드 작업의 오류가 서버를 죽이면 안 된다.
    logError(err, 'translationPipeline_unhandled');
  }
}

const translations = new Map<string, Promise<void>>();
export function translateMessageInBackground(io: Server | null, messageId: string): Promise<void> {
  const current = translations.get(messageId);
  if (current) return current;
  const task = translateMessage(io, messageId).finally(() => translations.delete(messageId));
  translations.set(messageId, task);
  return task;
}

/** 운영자가 실패한 번역을 다시 시도할 때 쓴다. */
export async function retryTranslation(io: Server | null, messageId: string): Promise<void> {
  if (translations.has(messageId)) { await translations.get(messageId); return; }
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || message.senderType !== 'customer' || ['done', 'edited'].includes(message.translationStatus)) return;
  await prisma.message.update({ where: { id: messageId }, data: { translationStatus: 'none' } });
  await translateMessageInBackground(io, messageId);
}


/** 번역을 켜면 최근 미번역 고객 메시지 20개도 순서대로 처리한다. */
export async function translateRecentMessages(io: Server | null, roomId: string): Promise<void> {
  try {
    const rows = await prisma.message.findMany({ where: { chatRoomId: roomId, senderType: 'customer', translationStatus: { in: ['none', 'failed'] } }, orderBy: { createdAt: 'desc' }, take: 20 });
    for (const row of rows) await translateMessageInBackground(io, row.id);
  } catch (err) { logError(err, 'translation_backfill_failed'); }
}
