import { LANGUAGES, type Language } from '@stemcare/shared';
import type { Server } from 'socket.io';
import { z } from 'zod';
import { config } from '../config';
import { prisma } from '../db';
import { logError } from '../common/logger';
import { createMessageRow } from '../messages/messageService';
import { broadcastMessage, broadcastStatus } from '../realtime/emitters';
import { callModel } from './aiClient';
import { shouldHandoff } from './handoffDetector';
import { CONSULTATION_SYSTEM_PROMPT } from './promptTemplates';
import { generateSummary } from './summarizer';

const BOT_TIMEOUT_MS = 15_000;
const HISTORY_LIMIT = 10;

export type BotDecision =
  | { kind: 'reply'; text: string; language: Language }
  | { kind: 'handoff'; reason: string }
  | { kind: 'skip' };

const BotResponseSchema = z.object({
  replyText: z.string().min(1),
  replyLanguage: z.enum(LANGUAGES),
  handoffRequired: z.boolean(),
  handoffReason: z.string().nullable().optional()
});

function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse((fenced ? fenced[1] : raw).trim());
}

const HANDOFF_NOTICE: Record<Language, string> = {
  ko: '담당자에게 연결해 드리겠습니다. 잠시만 기다려주세요. 정확한 비용과 예약 가능 여부는 담당자가 확인 후 안내드립니다.',
  ja: '担当者におつなぎいたします。少々お待ちください。正確な費用やご予約の可否は担当者が確認のうえご案内いたします。'
};

/**
 * AI 가 이번 턴에 무엇을 할지 결정한다. (저장은 하지 않는다)
 */
export async function generateBotReply(input: { roomId: string }): Promise<BotDecision> {
  const room = await prisma.chatRoom.findUnique({
    where: { id: input.roomId },
    include: { customer: true }
  });

  if (!room) return { kind: 'skip' };

  // "운영자 전환 후에는 AI가 자동으로 끼어들지 않는다" - bot 상태일 때만 답한다.
  // waiting(운영자 대기 중)에도 끼어들면, 전환 직후 고객이 보낸 다음 메시지마다
  // 안내 문구와 요약이 중복으로 쌓인다.
  if (room.status !== 'bot') return { kind: 'skip' };

  const history = await prisma.message.findMany({
    where: { chatRoomId: room.id, senderType: { in: ['customer', 'ai'] } },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_LIMIT
  });

  const ordered = [...history].reverse();
  const last = ordered[ordered.length - 1];

  // 마지막이 고객 메시지일 때만 답한다. (AI 가 혼자 계속 말하는 것을 막는다)
  if (!last || last.senderType !== 'customer') return { kind: 'skip' };

  const customerLanguage = room.customer.preferredLanguage as Language;

  // 1차 방어: 규칙 기반. AI 를 부르기 전에 위험한 주제를 걸러낸다.
  const unansweredCount =
    ordered.filter((m) => m.senderType === 'ai').length >= 2 ? countRecentUnanswered(ordered) : 0;

  const ruleCheck = shouldHandoff({ text: last.originalText, unansweredCount });
  if (ruleCheck.required) {
    return { kind: 'handoff', reason: ruleCheck.reason ?? '운영자 확인 필요' };
  }

  // 2차: AI 에게 물어본다.
  const transcript = ordered.map((m) => `${m.senderType === 'customer' ? '고객' : 'AI'}: ${m.originalText}`).join('\n');

  const userPrompt = [`고객 언어: ${customerLanguage}`, `희망 서비스: ${room.serviceType}`, '', '대화 내역:', transcript].join(
    '\n'
  );

  try {
    const raw = await callModel({
      model: config.aiModel,
      system: CONSULTATION_SYSTEM_PROMPT,
      user: userPrompt,
      timeoutMs: BOT_TIMEOUT_MS,
      jsonMode: true
    });

    const parsed = BotResponseSchema.safeParse(extractJson(raw));

    // 형식이 어긋나면 억지로 해석하지 않고 사람에게 넘긴다.
    if (!parsed.success) {
      return { kind: 'handoff', reason: 'AI 응답 형식 오류' };
    }

    if (parsed.data.handoffRequired) {
      return { kind: 'handoff', reason: parsed.data.handoffReason ?? 'AI 판단' };
    }

    return {
      kind: 'reply',
      text: parsed.data.replyText,
      language: parsed.data.replyLanguage
    };
  } catch {
    // AI 장애 시 상담을 멈추지 않고 운영자에게 넘긴다.
    return { kind: 'handoff', reason: 'AI 응답 실패' };
  }
}

/** AI 가 최근에 연속으로 같은 안내만 반복했는지 대략 센다. */
function countRecentUnanswered(ordered: Array<{ senderType: string; originalText: string }>): number {
  const aiTexts = ordered.filter((m) => m.senderType === 'ai').map((m) => m.originalText);
  if (aiTexts.length < 2) return 0;

  const lastTwo = aiTexts.slice(-2);
  return lastTwo[0] === lastTwo[1] ? 2 : 0;
}

/**
 * 결정을 실제로 실행한다: 메시지 저장 + 브로드캐스트 + 상태 변경.
 * 이 함수도 예외를 던지지 않는다.
 */
export async function runBotTurn(io: Server | null, roomId: string): Promise<void> {
  try {
    const decision = await generateBotReply({ roomId });
    if (decision.kind === 'skip') return;

    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: { customer: true }
    });
    if (!room) return;

    const customerLanguage = room.customer.preferredLanguage as Language;

    if (decision.kind === 'reply') {
      const row = await createMessageRow({
        chatRoomId: roomId,
        senderType: 'ai',
        text: decision.text,
        originalLanguage: decision.language,
        visibleText: decision.text,
        translationStatus: 'none'
      });

      if (io) await broadcastMessage(io, roomId, row);
      return;
    }

    // handoff
    const notice = await createMessageRow({
      chatRoomId: roomId,
      senderType: 'system',
      text: HANDOFF_NOTICE[customerLanguage],
      visibleText: HANDOFF_NOTICE[customerLanguage],
      originalLanguage: customerLanguage
    });

    await prisma.chatRoom.update({ where: { id: roomId }, data: { status: 'waiting' } });

    if (io) {
      await broadcastMessage(io, roomId, notice);
      broadcastStatus(io, roomId, 'waiting', room.assignedOperatorId);
    }

    // 운영자가 상황을 빨리 파악하도록 요약을 만들어 둔다.
    await generateSummary(roomId);
  } catch (err) {
    logError(err, 'consultationBot_unhandled');
  }
}
