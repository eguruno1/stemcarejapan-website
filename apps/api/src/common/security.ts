import type { Express, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { config, rateLimitFor } from '../config';

/**
 * 짧은 시간에 같은 IP 에서 오는 과도한 요청을 막는다.
 *
 * 이게 없으면:
 * - 로그인: 비밀번호를 무차별 대입으로 알아낼 수 있다.
 * - 상담 시작: 스팸 상담이 무한정 쌓여 DB 가 가득 찬다.
 */
export const loginLimiter: RequestHandler = rateLimit({
  windowMs: 60_000,
  limit: rateLimitFor('RATE_LIMIT_LOGIN', 10),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: '잠시 후 다시 시도해주세요.' } }
});

export const publicChatLimiter: RequestHandler = rateLimit({
  windowMs: 60_000,
  limit: rateLimitFor('RATE_LIMIT_CHAT_START', 10),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' } }
});

/** 메시지 전송은 조금 더 여유롭게 허용한다. 실제 대화가 막히면 안 된다. */
export const messageLimiter: RequestHandler = rateLimit({
  windowMs: 60_000,
  limit: rateLimitFor('RATE_LIMIT_MESSAGE', 60),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: '메시지를 너무 빠르게 보내고 있습니다.' } }
});

export function applySecurity(app: Express): void {
  app.use(
    helmet({
      // 이 서버는 JSON API 만 제공하므로 CSP 는 Nginx 쪽 정적 파일에 건다.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' }
    })
  );

  // Nginx 뒤에 있으므로 X-Forwarded-For 를 신뢰해야 rate limit 이 실제 IP 로 동작한다.
  if (config.nodeEnv === 'production') {
    app.set('trust proxy', 1);
  }

  // Express 버전 노출 제거
  app.disable('x-powered-by');
}
