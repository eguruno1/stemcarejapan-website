import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import { config } from './config';
import { applySecurity, loginLimiter, messageLimiter, publicChatLimiter } from './common/security';
import { httpLogger } from './common/logger';
import { errorHandler, notFound } from './common/errors';
import { authRoutes } from './auth/authRoutes';
import { translateRoutes } from './ai/translateRoutes';
import { adminChatRoutes } from './chatRooms/adminChatRoutes';
import { publicChatRoutes } from './chatRooms/publicChatRoutes';
import { metricsRoutes } from './ops/metricsRoutes';

export function createApp(): Express {
  const app = express();

  applySecurity(app);
  app.use(httpLogger);

  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'stemcare-chat-api' });
  });

  // limiter 는 라우터보다 먼저 등록해야 한다 - 미들웨어는 등록 순서대로 실행된다.
  app.use('/api/admin/auth/login', loginLimiter);
  app.use('/api/public/chat/start', publicChatLimiter);
  app.use('/api/public/chat', messageLimiter);

  app.use('/api/admin/auth', authRoutes);
  app.use('/api/admin/chat-rooms', adminChatRoutes);
  app.use('/api/admin/translate', translateRoutes);
  app.use('/api/admin/ops', metricsRoutes);
  app.use('/api/public/chat', publicChatRoutes);

  app.use((_req, _res, next) => next(notFound('요청한 경로를 찾을 수 없습니다.')));
  app.use(errorHandler);

  return app;
}
