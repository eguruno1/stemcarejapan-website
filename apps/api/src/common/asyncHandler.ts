import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Express 4 는 async 함수가 던진 예외를 자동으로 잡지 못한다.
 * 이 래퍼로 감싸야 errorHandler 까지 전달된다.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
