import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/db';
import { createMessageRow } from '../src/messages/messageService';
import { createCustomerWithRoom, createOperator } from './helpers/factories';
import { disconnectDatabase, resetDatabase } from './helpers/testDb';

const app = createApp();

async function loginAgent() {
  const { plainPassword } = await createOperator({ email: 'ops@stemcare.test' });
  const agent = request.agent(app);
  await agent.post('/api/admin/auth/login').send({ email: 'ops@stemcare.test', password: plainPassword });
  return agent;
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await disconnectDatabase();
});

describe('GET /api/admin/ops/metrics', () => {
  it('로그인하지 않으면 401 이다', async () => {
    const res = await request(app).get('/api/admin/ops/metrics');

    expect(res.status).toBe(401);
  });

  it('상태별 상담 수를 센다', async () => {
    const agent = await loginAgent();
    await createCustomerWithRoom({ status: 'waiting' });
    await createCustomerWithRoom({ status: 'waiting' });
    await createCustomerWithRoom({ status: 'active' });
    await createCustomerWithRoom({ status: 'bot' });

    const res = await agent.get('/api/admin/ops/metrics');

    expect(res.status).toBe(200);
    expect(res.body.metrics.waitingRooms).toBe(2);
    expect(res.body.metrics.activeRooms).toBe(1);
    expect(res.body.metrics.botRooms).toBe(1);
  });

  it('오늘 시작된 상담 수를 센다', async () => {
    const agent = await loginAgent();
    await createCustomerWithRoom();
    const old = await createCustomerWithRoom();
    await prisma.chatRoom.update({
      where: { id: old.room.id },
      data: { createdAt: new Date('2020-01-01') }
    });

    const res = await agent.get('/api/admin/ops/metrics');

    expect(res.body.metrics.todayStarted).toBe(1);
  });

  it('10분 넘게 응답 없는 상담을 센다', async () => {
    const agent = await loginAgent();
    const { room, customer } = await createCustomerWithRoom({ status: 'waiting' });
    const message = await createMessageRow({
      chatRoomId: room.id,
      senderType: 'customer',
      senderId: customer.id,
      text: '답변 기다립니다',
      originalLanguage: 'ko'
    });
    await prisma.message.update({
      where: { id: message.id },
      data: { createdAt: new Date(Date.now() - 15 * 60 * 1000) }
    });
    await prisma.chatRoom.update({
      where: { id: room.id },
      data: { lastMessageAt: new Date(Date.now() - 15 * 60 * 1000) }
    });

    const res = await agent.get('/api/admin/ops/metrics');

    expect(res.body.metrics.unansweredOver10Min).toBe(1);
  });

  it('24시간 내 번역 실패 건수를 센다', async () => {
    const agent = await loginAgent();
    const { room, customer } = await createCustomerWithRoom();
    await prisma.message.create({
      data: {
        chatRoomId: room.id,
        senderType: 'customer',
        senderId: customer.id,
        originalLanguage: 'ja',
        originalText: 'テスト',
        visibleText: 'テスト',
        translationStatus: 'failed'
      }
    });

    const res = await agent.get('/api/admin/ops/metrics');

    expect(res.body.metrics.translationFailures24h).toBe(1);
  });

  it('DB 연결 상태를 알려준다', async () => {
    const agent = await loginAgent();

    const res = await agent.get('/api/admin/ops/metrics');

    expect(res.body.metrics.dbOk).toBe(true);
  });
});

it('운영자가 이미 답변한 오래된 상담은 미응답으로 세지 않는다', async () => {
  const agent = await loginAgent();
  const { room } = await createCustomerWithRoom({ status: 'active' });
  await prisma.message.create({ data: { chatRoomId: room.id, senderType: 'customer', originalText: '질문', visibleText: '질문', createdAt: new Date(Date.now() - 30 * 60000) } });
  await prisma.message.create({ data: { chatRoomId: room.id, senderType: 'operator', originalText: '답변', visibleText: '답변', createdAt: new Date(Date.now() - 20 * 60000) } });
  await prisma.chatRoom.update({ where: { id: room.id }, data: { lastMessageAt: new Date(Date.now() - 20 * 60000) } });
  expect((await agent.get('/api/admin/ops/metrics')).body.metrics.unansweredOver10Min).toBe(0);
});
