import type { Language } from '@stemcare/shared';
import { callModel } from './aiClient';
import { config } from '../config';
import { translationSystemPrompt } from './promptTemplates';

const TRANSLATION_TIMEOUT_MS = 8000;
const MAX_INPUT_CHARS = 2000;

export type TranslationResult =
  | { status: 'done'; text: string; model: string }
  | { status: 'skipped'; text: string }
  | { status: 'failed'; reason: string };

/** 모델이 가끔 붙이는 따옴표·머리말을 제거한다. */
function cleanOutput(raw: string): string {
  let text = raw.trim();

  // 앞뒤를 감싼 따옴표 제거
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith('「') && text.endsWith('」'))) {
    text = text.slice(1, -1).trim();
  }

  // "번역:" 같은 머리말 제거
  text = text.replace(/^(번역|翻訳|Translation)\s*[::]\s*/i, '').trim();

  return text;
}

/**
 * 한↔일 번역.
 *
 * 중요: 이 함수는 예외를 던지지 않는다.
 * 번역 실패로 메시지 전체가 막히면 안 되기 때문에, 실패도 정상적인 결과값으로 돌려준다.
 * 호출부는 status 를 보고 판단한다.
 */
export async function translate(input: {
  text: string;
  source: Language;
  target: Language;
}): Promise<TranslationResult> {
  const text = input.text.trim();

  if (text.length === 0) return { status: 'skipped', text: input.text };
  if (input.source === input.target) return { status: 'skipped', text };

  const truncated = text.length > MAX_INPUT_CHARS ? text.slice(0, MAX_INPUT_CHARS) : text;

  try {
    const raw = await callModel({
      model: config.translationModel,
      system: translationSystemPrompt(input.source, input.target),
      user: truncated,
      timeoutMs: TRANSLATION_TIMEOUT_MS
    });

    const cleaned = cleanOutput(raw);
    if (cleaned.length === 0) {
      return { status: 'failed', reason: 'EMPTY_RESPONSE' };
    }

    return { status: 'done', text: cleaned, model: config.translationModel };
  } catch (err) {
    console.warn('[translate] 실패:', err instanceof Error ? err.message : err);
    return { status: 'failed', reason: 'AI_UNAVAILABLE' };
  }
}
