import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/db';
import { createCustomerWithRoom, createOperator } from './helpers/factories';
import { disconnectDatabase, resetDatabase } from './helpers/testDb';

const app = createApp();

async function loginAgent(email = 'op@stemcare.test') {
  const { operator, plainPassword } = await createOperator({ email });
  const agent = request.agent(app);
  await agent.post('/api/admin/auth/login').send({ email, password: plainPassword });
  return { agent, operator };
}

describe('PATCH /api/admin/chat-rooms/:roomId/assign', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('배정하면 담당자가 지정되고 상태가 active 로 바뀐다', async () => {
    const { agent, operator } = await loginAgent();
    const { room } = await createCustomerWithRoom({ status: 'waiting' });

    const res = await agent.patch(`/api/admin/chat-rooms/${room.id}/assign`);

    expect(res.status).toBe(200);
    expect(res.body.room.assignedOperatorId).toBe(operator.id);
    expect(res.body.room.status).toBe('active');
  });

  it('배정 시 시스템 메시지가 남는다', async () => {
    const { agent } = await loginAgent();
    const { room } = await createCustomerWithRoom({ status: 'waiting' });

    await agent.patch(`/api/admin/chat-rooms/${room.id}/assign`);

    const systemMessages = await prisma.message.findMany({
      where: { chatRoomId: room.id, senderType: 'system' }
    });
    expect(systemMessages).toHaveLength(1);
    expect(systemMessages[0].visibleText).toContain('운영자');
  });

  it('이미 다른 운영자가 맡은 상담은 409 이다', async () => {
    const first = await loginAgent('a@stemcare.test');
    const second = await loginAgent('b@stemcare.test');
    const { room } = await createCustomerWithRoom({ status: 'waiting' });

    await first.agent.patch(`/api/admin/chat-rooms/${room.id}/assign`).expect(200);
    const res = await second.agent.patch(`/api/admin/chat-rooms/${room.id}/assign`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_ASSIGNED');
  });

  it('같은 운영자가 다시 배정을 눌러도 200 이다', async () => {
    const { agent } = await loginAgent();
    const { room } = await createCustomerWithRoom({ status: 'waiting' });

    await agent.patch(`/api/admin/chat-rooms/${room.id}/assign`).expect(200);
    await agent.patch(`/api/admin/chat-rooms/${room.id}/assign`).expect(200);
  });
});

describe('PATCH /api/admin/chat-rooms/:roomId/status', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('상태를 closed 로 바꾸면 closedAt 이 기록된다', async () => {
    const { agent } = await loginAgent();
    const { room } = await createCustomerWithRoom({ status: 'active' });

    const res = await agent.patch(`/api/admin/chat-rooms/${room.id}/status`).send({ status: 'closed' });

    expect(res.status).toBe(200);
    expect(res.body.room.status).toBe('closed');
    expect(res.body.room.closedAt).not.toBeNull();
  });

  it('허용되지 않은 상태값은 400 이다', async () => {
    const { agent } = await loginAgent();
    const { room } = await createCustomerWithRoom();

    const res = await agent.patch(`/api/admin/chat-rooms/${room.id}/status`).send({ status: 'zombie' });

    expect(res.status).toBe(400);
  });

  it('closed 를 다시 active 로 되돌릴 수 있다 (재상담)', async () => {
    const { agent } = await loginAgent();
    const { room } = await createCustomerWithRoom({ status: 'closed' });

    const res = await agent.patch(`/api/admin/chat-rooms/${room.id}/status`).send({ status: 'active' });

    expect(res.status).toBe(200);
    expect(res.body.room.closedAt).toBeNull();
  });
});

describe('POST /api/admin/chat-rooms/:roomId/messages', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('운영자 메시지를 저장한다', async () => {
    const { agent, operator } = await loginAgent();
    const { room } = await createCustomerWithRoom({ status: 'active' });

    const res = await agent
      .post(`/api/admin/chat-rooms/${room.id}/messages`)
      .send({ originalText: '방문 예정일을 알려주세요.', originalLanguage: 'ko' });

    expect(res.status).toBe(201);
    expect(res.body.message.senderType).toBe('operator');
    expect(res.body.message.senderId).toBe(operator.id);
    expect(res.body.message.visibleText).toBe('방문 예정일을 알려주세요.');
  });

  it('번역문을 함께 보내면 고객이 보는 문장은 번역문이 된다', async () => {
    const { agent } = await loginAgent();
    const { room } = await createCustomerWithRoom({ status: 'active' });

    const res = await agent.post(`/api/admin/chat-rooms/${room.id}/messages`).send({
      originalText: '방문 예정일을 알려주세요.',
      originalLanguage: 'ko',
      translatedText: 'ご訪問予定日を教えてください。',
      translatedLanguage: 'ja'
    });

    expect(res.body.message.visibleText).toBe('ご訪問予定日を教えてください。');
    expect(res.body.message.originalText).toBe('방문 예정일을 알려주세요.');
    expect(res.body.message.translationStatus).toBe('done');
  });

  it('종료된 상담에는 보낼 수 없다', async () => {
    const { agent } = await loginAgent();
    const { room } = await createCustomerWithRoom({ status: 'closed' });

    const res = await agent
      .post(`/api/admin/chat-rooms/${room.id}/messages`)
      .send({ originalText: '종료 후', originalLanguage: 'ko' });

    expect(res.status).toBe(409);
  });

  it('로그인하지 않으면 401 이다', async () => {
    const { room } = await createCustomerWithRoom();

    const res = await request(app)
      .post(`/api/admin/chat-rooms/${room.id}/messages`)
      .send({ originalText: '무단 전송', originalLanguage: 'ko' });

    expect(res.status).toBe(401);
  });
});

describe('POST /api/admin/chat-rooms/:roomId/notes', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('메모를 저장하고 작성자 이름을 함께 반환한다', async () => {
    const { agent, operator } = await loginAgent();
    const { room } = await createCustomerWithRoom();

    const res = await agent
      .post(`/api/admin/chat-rooms/${room.id}/notes`)
      .send({ note: '항공권 일정 확인 필요' });

    expect(res.status).toBe(201);
    expect(res.body.note.note).toBe('항공권 일정 확인 필요');
    expect(res.body.note.operatorName).toBe(operator.name);
  });

  it('메모는 고객 API 응답에 절대 포함되지 않는다', async () => {
    const { agent } = await loginAgent();
    const { room, visitorToken } = await createCustomerWithRoom();
    await agent.post(`/api/admin/chat-rooms/${room.id}/notes`).send({ note: '내부 전용 메모' });

    const res = await request(app)
      .get(`/api/public/chat/${room.id}`)
      .set('X-Visitor-Token', visitorToken);

    expect(JSON.stringify(res.body)).not.toContain('내부 전용 메모');
  });

  it('빈 메모는 400 이다', async () => {
    const { agent } = await loginAgent();
    const { room } = await createCustomerWithRoom();

    const res = await agent.post(`/api/admin/chat-rooms/${room.id}/notes`).send({ note: '  ' });

    expect(res.status).toBe(400);
  });
});
