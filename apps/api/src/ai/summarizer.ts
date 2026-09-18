import type { ChatSummary } from '@prisma/client';
import { z } from 'zod';
import { config } from '../config';
import { prisma } from '../db';
import { logWarn } from '../common/logger';
import { callModel } from './aiClient';
import { SUMMARY_SYSTEM_PROMPT } from './promptTemplates';

const SUMMARY_TIMEOUT_MS = 15_000;
const MAX_HISTORY = 20;

const SummarySchema = z.object({
  summary: z.string().min(1),
  customerNeeds: z.string().nullable().optional(),
  nextAction: z.string().nullable().optional(),
  riskFlags: z.array(z.string()).default([])
});

/** 모델이 ```json ... ``` 로 감싸서 주는 경우가 있어 벗겨낸다. */
function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : raw).trim();
  return JSON.parse(candidate);
}

/**
 * 상담 내용을 요약해 저장한다.
 * 실패하면 null 을 돌려주고 상담 흐름을 막지 않는다.
 */
export async function generateSummary(roomId: string): Promise<ChatSummary | null> {
  try {
    const messages = await prisma.message.findMany({
      where: { chatRoomId: roomId, senderType: { in: ['customer', 'ai', 'operator'] } },
      orderBy: { createdAt: 'asc' },
      take: MAX_HISTORY
    });

    if (messages.length === 0) return null;

    const transcript = messages
      .map((m) => {
        const who = m.senderType === 'customer' ? '고객' : m.senderType === 'ai' ? 'AI' : '운영자';
        // 한국어 번역이 있으면 그걸 쓴다. 요약은 한국어로 만든다.
        return `${who}: ${m.translatedLanguage === 'ko' ? m.translatedText : m.originalText}`;
      })
      .join('\n');

    const raw = await callModel({
      model: config.aiModel,
      system: SUMMARY_SYSTEM_PROMPT,
      user: transcript,
      timeoutMs: SUMMARY_TIMEOUT_MS,
      jsonMode: true
    });

    const parsed = SummarySchema.safeParse(extractJson(raw));
    if (!parsed.success) {
      logWarn('summarizer_invalid_response');
      return null;
    }

    return prisma.chatSummary.create({
      data: {
        chatRoomId: roomId,
        summary: parsed.data.summary,
        customerNeeds: parsed.data.customerNeeds ?? null,
        nextAction: parsed.data.nextAction ?? null,
        riskFlags: parsed.data.riskFlags
      }
    });
  } catch (err) {
    logWarn('summarizer_failed', { reason: err instanceof Error ? err.message : String(err) });
    return null;
  }
}
