import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { config } from './config';

export function createApp(): Express {
  const app = express();

  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true
    })
  );
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'stemcare-chat-api' });
  });

  // 등록된 라우터에 걸리지 않은 모든 요청
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: '요청한 경로를 찾을 수 없습니다.' }
    });
  });

  // 마지막 안전망: 어디선가 던져진 예외를 표준 형식으로 바꾼다.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[unhandled]', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: '서버 내부 오류가 발생했습니다.' }
    });
  });

  return app;
}
