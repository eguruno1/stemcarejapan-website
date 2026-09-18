import type { RequestHandler } from 'express';
import { ZodError, type ZodSchema } from 'zod';
import { badRequest } from './errors';

export function validateBody<T>(schema: ZodSchema<T>): RequestHandler {
  return (req, _res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(
          badRequest(
            'VALIDATION_ERROR',
            '입력값을 확인해주세요.',
            err.issues.map((issue) => ({
              field: issue.path.join('.'),
              message: issue.message
            }))
          )
        );
        return;
      }
      next(err);
    }
  };
}

export function validateQuery<T>(schema: ZodSchema<T>): RequestHandler {
  return (req, _res, next) => {
    try {
      // query 는 읽기 전용일 수 있으므로 별도 속성에 담는다.
      (req as unknown as { validatedQuery: T }).validatedQuery = schema.parse(req.query);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(
          badRequest(
            'VALIDATION_ERROR',
            '조회 조건을 확인해주세요.',
            err.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }))
          )
        );
        return;
      }
      next(err);
    }
  };
}
