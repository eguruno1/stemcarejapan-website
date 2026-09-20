import { getChatSettings } from '../settings/chatSettings';
import { callOllama } from './ollamaClient';
import type { Language } from '@stemcare/shared';
import { AiConfigurationError, callModel } from './aiClient';
import { config } from '../config';
import { logWarn } from '../common/logger';
import { translationSystemPrompt } from './promptTemplates';

const TRANSLATION_TIMEOUT_MS = 8000;
const MAX_INPUT_CHARS = 2000;

export type TranslationResult =
  | { status: 'done'; text: string; model: string }
  | { status: 'skipped'; text: string }
  | { status: 'failed'; reason: string };

export function translationFailureMessage(reason: string): string {
  if (reason === 'EXTERNAL_NOT_CONFIGURED') return '외부 번역 API 키가 설정되지 않았습니다. 설정에서 로컬 Ollama를 선택하고 「설정 저장」을 누르거나 서버의 외부 API 키를 설정해주세요.';
  if (reason === 'OLLAMA_UNAVAILABLE') return '로컬 Ollama 번역에 실패했습니다. Ollama 실행 상태와 모델 설치를 확인한 뒤 설정에서 「선택한 제공자 연결 확인」으로 다시 확인해주세요.';
  return '번역에 실패했습니다. 설정에서 번역 제공자 연결을 확인하거나 잠시 후 다시 시도해주세요.';
}

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
  provider?: 'external' | 'ollama';
}): Promise<TranslationResult> {
  const text = input.text.trim();

  if (text.length === 0) return { status: 'skipped', text: input.text };
  if (input.source === input.target) return { status: 'skipped', text };

  const truncated = text.length > MAX_INPUT_CHARS ? text.slice(0, MAX_INPUT_CHARS) : text;

  let provider: 'external' | 'ollama' | undefined = input.provider;
  try {
    const settings = await getChatSettings();
    if (!input.provider && !settings.translationEnabled) return { status: 'skipped', text };
    provider = input.provider ?? settings.translationProvider;
    const model = provider === 'ollama' ? config.ollamaModel : config.translationModel;
    const raw = await (provider === 'ollama' ? callOllama : callModel)({
      model,
      system: translationSystemPrompt(input.source, input.target),
      user: truncated,
      timeoutMs: provider === 'ollama' ? config.ollamaTimeoutMs : TRANSLATION_TIMEOUT_MS
    });

    const cleaned = cleanOutput(raw);
    if (cleaned.length === 0 || cleaned.length > 2000) {
      return { status: 'failed', reason: 'EMPTY_RESPONSE' };
    }

    return { status: 'done', text: cleaned, model };
  } catch (err) {
    logWarn('translate_failed', { reason: err instanceof Error ? err.message : String(err) });
    return { status: 'failed', reason: err instanceof AiConfigurationError ? 'EXTERNAL_NOT_CONFIGURED' : provider === 'ollama' ? 'OLLAMA_UNAVAILABLE' : 'AI_UNAVAILABLE' };
  }
}
