import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { asyncHandler } from '../src/common/asyncHandler';
import { AppError, badRequest, errorHandler } from '../src/common/errors';
import { validateBody } from '../src/common/validate';

function buildTestApp() {
  const app = express();
  app.use(express.json());

  app.post(
    '/echo',
    validateBody(z.object({ name: z.string().min(1), age: z.number().int().min(0) })),
    (req, res) => res.json(req.body)
  );

  app.get(
    '/boom',
    asyncHandler(async () => {
      throw badRequest('CUSTOM_CODE', '일부러 낸 오류');
    })
  );

  app.get(
    '/unknown-boom',
    asyncHandler(async () => {
      throw new Error('예상 못 한 오류');
    })
  );

  app.use(errorHandler);
  return app;
}

describe('공통 오류 처리', () => {
  it('검증을 통과하면 파싱된 body 를 그대로 쓴다', async () => {
    const res = await request(buildTestApp()).post('/echo').send({ name: '홍길동', age: 30 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: '홍길동', age: 30 });
  });

  it('검증 실패는 400 VALIDATION_ERROR 로 응답한다', async () => {
    const res = await request(buildTestApp()).post('/echo').send({ name: '', age: -1 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  it('AppError 는 지정한 status 와 code 로 응답한다', async () => {
    const res = await request(buildTestApp()).get('/boom');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CUSTOM_CODE');
    expect(res.body.error.message).toBe('일부러 낸 오류');
  });

  it('예상 못 한 오류는 내부 메시지를 감추고 500 으로 응답한다', async () => {
    const res = await request(buildTestApp()).get('/unknown-boom');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.body.error.message).not.toContain('예상 못 한 오류');
  });

  it('AppError 는 instanceof 로 구분된다', () => {
    expect(new AppError(404, 'NOT_FOUND', '없음')).toBeInstanceOf(Error);
  });
});
