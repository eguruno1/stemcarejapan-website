import OpenAI from 'openai';
import { config } from '../config';

export class AiUnavailableError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'AiUnavailableError';
  }
}

export class AiConfigurationError extends AiUnavailableError {}

export interface ModelCallInput {
  model: string;
  system: string;
  user: string;
  timeoutMs: number;
  signal?: AbortSignal;
  /** true 면 모델에게 JSON 만 출력하라고 지시한다. */
  jsonMode?: boolean;
}

export type ModelCaller = (input: ModelCallInput) => Promise<string>;

/**
 * 테스트에서 가짜 구현으로 갈아끼우는 지점.
 * null 이면 실제 OpenAI 를 호출한다.
 */
let injectedCaller: ModelCaller | null = null;

export function setModelCaller(caller: ModelCaller | null): void {
  injectedCaller = caller;
}

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!config.openaiApiKey) {
    throw new AiConfigurationError('OPENAI_API_KEY 가 설정되지 않았습니다.');
  }
  client ??= new OpenAI({ apiKey: config.openaiApiKey });
  return client;
}

const defaultCaller: ModelCaller = async ({ model, system, user, jsonMode, timeoutMs, signal }) => {
  const response = await getClient().chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    ...(jsonMode ? { response_format: { type: 'json_object' as const } } : {})
  }, { timeout: timeoutMs, maxRetries: 0, signal });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('모델이 빈 응답을 반환했습니다.');
  return content;
};

/** 주어진 시간 안에 끝나지 않으면 거부한다. */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new AiUnavailableError(`응답이 ${timeoutMs}ms 안에 오지 않았습니다.`)),
      timeoutMs
    );

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * 모든 AI 호출은 이 함수 하나만 거친다.
 * `injectedCaller`(테스트) 가 있으면 그걸, 없으면 실제 OpenAI 를 부른다.
 * 어느 쪽이든 타임아웃과 오류를 AiUnavailableError 하나로 통일해서 돌려준다 —
 * 호출부(translator, consultationBot)가 실패 원인을 일일이 구분하지 않아도 되게 한다.
 */
export async function callModel(input: ModelCallInput): Promise<string> {
  const caller = injectedCaller ?? defaultCaller;

  const controller = new AbortController();
  try {
    return await withTimeout(caller({ ...input, signal: controller.signal }), input.timeoutMs);
  } catch (err) {
    if (err instanceof AiUnavailableError) throw err;
    throw new AiUnavailableError('AI 호출에 실패했습니다.', err);
  } finally { controller.abort(); }
}
