import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import { config } from './config';
import { errorHandler, notFound } from './common/errors';
import { authRoutes } from './auth/authRoutes';
import { translateRoutes } from './ai/translateRoutes';
import { adminChatRoutes } from './chatRooms/adminChatRoutes';
import { publicChatRoutes } from './chatRooms/publicChatRoutes';

export function createApp(): Express {
  const app = express();

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

  app.use('/api/admin/auth', authRoutes);
  app.use('/api/admin/chat-rooms', adminChatRoutes);
  app.use('/api/admin/translate', translateRoutes);
  app.use('/api/public/chat', publicChatRoutes);

  app.use((_req, _res, next) => next(notFound('요청한 경로를 찾을 수 없습니다.')));
  app.use(errorHandler);

  return app;
}
