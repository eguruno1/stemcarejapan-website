import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/db';
import { createCustomerWithRoom, createOperator } from './helpers/factories';
import { disconnectDatabase, resetDatabase } from './helpers/testDb';

const app = createApp();

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await disconnectDatabase();
});

describe('POST /api/public/chat/:roomId/feedback', () => {
  it('종료된 상담에 평점을 남길 수 있다', async () => {
    const { room, visitorToken } = await createCustomerWithRoom({ status: 'closed' });

    const res = await request(app)
      .post(`/api/public/chat/${room.id}/feedback`)
      .set('X-Visitor-Token', visitorToken)
      .send({ rating: 5, comment: '친절하게 안내해주셔서 감사합니다.' });

    expect(res.status).toBe(201);
    expect(res.body.feedback.rating).toBe(5);

    const saved = await prisma.chatFeedback.findUniqueOrThrow({
      where: { chatRoomId: room.id }
    });
    expect(saved.comment).toBe('친절하게 안내해주셔서 감사합니다.');
  });

  it('의견 없이 평점만 남길 수 있다', async () => {
    const { room, visitorToken } = await createCustomerWithRoom({ status: 'closed' });

    const res = await request(app)
      .post(`/api/public/chat/${room.id}/feedback`)
      .set('X-Visitor-Token', visitorToken)
      .send({ rating: 4 });

    expect(res.status).toBe(201);
    expect(res.body.feedback.comment).toBeNull();
  });

  it('토큰이 없으면 401 이다', async () => {
    const { room } = await createCustomerWithRoom({ status: 'closed' });

    const res = await request(app).post(`/api/public/chat/${room.id}/feedback`).send({ rating: 5 });

    expect(res.status).toBe(401);
  });

  it('남의 상담방에는 평점을 남길 수 없다', async () => {
    const mine = await createCustomerWithRoom({ status: 'closed' });
    const other = await createCustomerWithRoom({ status: 'closed' });

    const res = await request(app)
      .post(`/api/public/chat/${other.room.id}/feedback`)
      .set('X-Visitor-Token', mine.visitorToken)
      .send({ rating: 1 });

    expect(res.status).toBe(403);
  });

  it('1~5 범위를 벗어난 평점은 400 이다', async () => {
    const { room, visitorToken } = await createCustomerWithRoom({ status: 'closed' });

    for (const rating of [0, 6, 3.5, -1]) {
      const res = await request(app)
        .post(`/api/public/chat/${room.id}/feedback`)
        .set('X-Visitor-Token', visitorToken)
        .send({ rating });

      expect(res.status).toBe(400);
    }
  });

  it('아직 진행 중인 상담에는 평가할 수 없다', async () => {
    const { room, visitorToken } = await createCustomerWithRoom({ status: 'active' });

    const res = await request(app)
      .post(`/api/public/chat/${room.id}/feedback`)
      .set('X-Visitor-Token', visitorToken)
      .send({ rating: 5 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ROOM_NOT_CLOSED');
  });

  it('같은 상담에 두 번 평가하면 409 다', async () => {
    const { room, visitorToken } = await createCustomerWithRoom({ status: 'closed' });

    await request(app)
      .post(`/api/public/chat/${room.id}/feedback`)
      .set('X-Visitor-Token', visitorToken)
      .send({ rating: 5 })
      .expect(201);

    const res = await request(app)
      .post(`/api/public/chat/${room.id}/feedback`)
      .set('X-Visitor-Token', visitorToken)
      .send({ rating: 1 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_SUBMITTED');
    // 첫 평점이 덮어써지지 않아야 한다.
    const saved = await prisma.chatFeedback.findUniqueOrThrow({ where: { chatRoomId: room.id } });
    expect(saved.rating).toBe(5);
  });

  it('너무 긴 의견은 400 이다', async () => {
    const { room, visitorToken } = await createCustomerWithRoom({ status: 'closed' });

    const res = await request(app)
      .post(`/api/public/chat/${room.id}/feedback`)
      .set('X-Visitor-Token', visitorToken)
      .send({ rating: 5, comment: 'あ'.repeat(1001) });

    expect(res.status).toBe(400);
  });
});

describe('운영 지표의 평점 집계', () => {
  it('최근 30일 평균 평점과 건수를 준다', async () => {
    const { plainPassword } = await createOperator({ email: 'fb@stemcare.test' });
    const agent = request.agent(app);
    await agent
      .post('/api/admin/auth/login')
      .send({ email: 'fb@stemcare.test', password: plainPassword });

    for (const rating of [5, 3]) {
      const { room, visitorToken } = await createCustomerWithRoom({ status: 'closed' });
      await request(app)
        .post(`/api/public/chat/${room.id}/feedback`)
        .set('X-Visitor-Token', visitorToken)
        .send({ rating })
        .expect(201);
    }

    const res = await agent.get('/api/admin/ops/metrics');

    expect(res.body.metrics.feedbackCount30d).toBe(2);
    expect(res.body.metrics.avgRating30d).toBe(4);
  });

  it('평가가 없으면 평균은 null 이다', async () => {
    const { plainPassword } = await createOperator({ email: 'fb2@stemcare.test' });
    const agent = request.agent(app);
    await agent
      .post('/api/admin/auth/login')
      .send({ email: 'fb2@stemcare.test', password: plainPassword });

    const res = await agent.get('/api/admin/ops/metrics');

    expect(res.body.metrics.avgRating30d).toBeNull();
    expect(res.body.metrics.feedbackCount30d).toBe(0);
  });
});
