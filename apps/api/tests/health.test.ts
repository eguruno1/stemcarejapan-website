import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('GET /health', () => {
  it('서버가 살아 있으면 status ok 를 반환한다', async () => {
    const app = createApp();

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      service: 'stemcare-chat-api'
    });
  });

  it('정의되지 않은 경로는 표준 오류 형식으로 404를 반환한다', async () => {
    const app = createApp();

    const response = await request(app).get('/이런경로는없다');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
