import type { NextFunction, Request, Response } from 'express';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function badRequest(code: string, message: string, details?: unknown): AppError {
  return new AppError(400, code, message, details);
}

export function unauthorized(message = '로그인이 필요합니다.'): AppError {
  return new AppError(401, 'UNAUTHORIZED', message);
}

export function forbidden(message = '접근 권한이 없습니다.'): AppError {
  return new AppError(403, 'FORBIDDEN', message);
}

export function notFound(message = '요청한 리소스를 찾을 수 없습니다.'): AppError {
  return new AppError(404, 'NOT_FOUND', message);
}

export function conflict(code: string, message: string): AppError {
  return new AppError(409, code, message);
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details }
    });
    return;
  }

  // 우리가 예상하지 못한 오류. 내부 사정을 고객에게 노출하지 않는다.
  console.error('[unhandled error]', err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: '서버 내부 오류가 발생했습니다.' }
  });
}
