import { randomUUID } from 'node:crypto';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { config } from '../config';

/**
 * 로그에 절대 남기면 안 되는 필드 이름들.
 *
 * 상담 본문(originalText 등)까지 포함하는 이유:
 * 이 시스템의 대화에는 건강 상태나 시술 관심사가 들어갈 수 있다.
 * 그런 내용은 접근 통제가 되는 DB 에만 있어야 하고,
 * 서버 로그 파일에 흩어지면 안 된다.
 */
const SENSITIVE_KEYS = new Set([
  'name',
  'customerName',
  'phone',
  'email',
  'memo',
  'note',
  'password',
  'passwordHash',
  'visitorToken',
  'visitorTokenHash',
  'operatorToken',
  'authorization',
  'cookie',
  'set-cookie',
  'originalText',
  'translatedText',
  'visibleText',
  'text',
  'message',
  'summary',
  'replyText', 'comment', 'customerNeeds', 'nextAction', 'reason', 'stack', 'x-visitor-token'
].map(key => key.toLowerCase()));

const REDACTED = '[REDACTED]';

export function maskPersonalData(value: unknown, depth = 0): unknown {
  if (depth > 6) return REDACTED;
  if (value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map((item) => maskPersonalData(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(key) || SENSITIVE_KEYS.has(key.toLowerCase())) {
      result[key] = REDACTED;
      continue;
    }
    result[key] = maskPersonalData(item, depth + 1);
  }
  return result;
}

export const logger = pino({
  // 테스트는 요청마다(194+개) 로그 한 줄씩 찍히면 터미널이 순식간에 뒤덮인다 -
  // 테스트는 응답을 직접 검증하지 로그를 읽지 않으므로 조용히 둔다.
  level: config.nodeEnv === 'production' ? 'info' : config.nodeEnv === 'test' ? 'silent' : 'debug',
  // 개발 중에는 사람이 읽기 좋게, 운영에서는 JSON 한 줄로.
  transport:
    config.nodeEnv === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
      : undefined,
  // pino 자체 redact 도 함께 건다. (헤더처럼 우리가 손대지 않는 경로용)
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'req.headers["x-visitor-token"]',
      'res.headers["set-cookie"]',
      'req.body.password',
      'req.body.name',
      'req.body.phone',
      'req.body.email',
      'req.body.message',
      'req.body.text',
      'req.body.originalText'
    ],
    censor: REDACTED
  }
});

export const httpLogger = pinoHttp({
  logger,
  genReqId: () => randomUUID(),
  // 본문은 아예 로그에 넣지 않는다. 경로와 상태만으로 충분히 디버깅할 수 있다.
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url?.split('?')[0] }),
    res: (res) => ({ statusCode: res.statusCode })
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  }
});

/** 예외에는 입력 본문이 포함될 수 있으므로 타입·기계 코드만 남긴다. */
export function logError(err: unknown, msg: string, extra?: Record<string, unknown>): void {
  const code = err instanceof Error ? (err as Error & { code?: unknown }).code : undefined;
  logger.error({
    ...(extra ? { context: maskPersonalData(extra) } : {}),
    err: err instanceof Error ? {
      type: err.name,
      code: typeof code === 'string' && /^[A-Z0-9_]+$/.test(code) ? code : undefined
    } : typeof err === 'object' ? maskPersonalData(err) : REDACTED
  }, msg);
}

/** AI 호출 실패 등, 서비스는 계속되지만 남겨둘 만한 경고. */
export function logWarn(msg: string, extra?: Record<string, unknown>): void {
  logger.warn(extra ? { context: maskPersonalData(extra) } : {}, msg);
}
