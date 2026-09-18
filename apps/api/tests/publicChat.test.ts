import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/db';
import { createCustomerWithRoom } from './helpers/factories';
import { disconnectDatabase, resetDatabase } from './helpers/testDb';

const app = createApp();

const validPayload = {
  name: '야마다 타로',
  phone: '+81 90-1234-5678',
  email: 'yamada@example.com',
  preferredLanguage: 'ja',
  serviceType: 'korea_travel',
  sourcePage: '/korea-travel/',
  message: '来月、母と2人で韓国に行きたいです。',
  privacyAgreed: true
};

// 파일 전체가 하나의 prisma 연결을 공유한다. describe 블록마다 disconnect 하면
// 아직 끝나지 않은 백그라운드 작업(AI 상담 봇 등)이 끊긴 연결에 걸려 이후
// 블록의 resetDatabase 까지 함께 깨진다 — 그래서 파일 끝에서 한 번만 끊는다.
afterAll(async () => {
  await disconnectDatabase();
});

describe('POST /api/public/chat/start', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('고객과 상담방을 만들고 visitorToken 을 반환한다', async () => {
    const res = await request(app).post('/api/public/chat/start').send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.roomId).toEqual(expect.any(String));
    expect(res.body.customerId).toEqual(expect.any(String));
    expect(res.body.visitorToken).toMatch(/^[0-9a-f]{64}$/);
    expect(res.body.status).toBe('bot');

    expect(await prisma.customer.count()).toBe(1);
    expect(await prisma.chatRoom.count()).toBe(1);
  });

  it('첫 문의 내용이 있으면 첫 메시지로 저장된다', async () => {
    const res = await request(app).post('/api/public/chat/start').send(validPayload);

    // AI 고정 인사(Phase 5) 가 문의 뒤에 항상 하나 더 남는다.
    const messages = await prisma.message.findMany({
      where: { chatRoomId: res.body.roomId },
      orderBy: { createdAt: 'asc' }
    });
    expect(messages).toHaveLength(2);
    expect(messages[0].senderType).toBe('customer');
    expect(messages[0].originalText).toBe(validPayload.message);
    expect(messages[0].visibleText).toBe(validPayload.message);
    expect(messages[1].senderType).toBe('ai');
  });

  it('첫 문의 내용이 없어도 상담방은 만들어지고 AI 인사가 남는다', async () => {
    const { message, ...withoutMessage } = validPayload;

    const res = await request(app).post('/api/public/chat/start').send(withoutMessage);

    expect(res.status).toBe(201);
    const messages = await prisma.message.findMany({ where: { chatRoomId: res.body.roomId } });
    expect(messages).toHaveLength(1);
    expect(messages[0].senderType).toBe('ai');
  });

  it('개인정보 동의가 없으면 400 을 반환하고 아무것도 저장하지 않는다', async () => {
    const res = await request(app)
      .post('/api/public/chat/start')
      .send({ ...validPayload, privacyAgreed: false });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await prisma.customer.count()).toBe(0);
  });

  it('이름이 비어 있으면 400 을 반환한다', async () => {
    const res = await request(app)
      .post('/api/public/chat/start')
      .send({ ...validPayload, name: '' });

    expect(res.status).toBe(400);
  });

  it('알 수 없는 serviceType 은 400 을 반환한다', async () => {
    const res = await request(app)
      .post('/api/public/chat/start')
      .send({ ...validPayload, serviceType: 'unknown_service' });

    expect(res.status).toBe(400);
  });

  it('원본 visitorToken 은 DB에 저장되지 않는다', async () => {
    const res = await request(app).post('/api/public/chat/start').send(validPayload);

    const room = await prisma.chatRoom.findUniqueOrThrow({ where: { id: res.body.roomId } });
    expect(room.visitorTokenHash).not.toBe(res.body.visitorToken);
    expect(room.visitorTokenHash).toHaveLength(64);
  });
});

describe('GET /api/public/chat/:roomId', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('올바른 visitorToken 이면 상담방과 메시지를 반환한다', async () => {
    const { room, visitorToken, customer } = await createCustomerWithRoom();

    const res = await request(app)
      .get(`/api/public/chat/${room.id}`)
      .set('X-Visitor-Token', visitorToken);

    expect(res.status).toBe(200);
    expect(res.body.roomId).toBe(room.id);
    expect(res.body.status).toBe('bot');
    expect(res.body.customerName).toBe(customer.name);
    expect(Array.isArray(res.body.messages)).toBe(true);
  });

  it('토큰이 없으면 401 을 반환한다', async () => {
    const { room } = await createCustomerWithRoom();

    const res = await request(app).get(`/api/public/chat/${room.id}`);

    expect(res.status).toBe(401);
  });

  it('다른 상담방의 토큰으로는 열 수 없다', async () => {
    const a = await createCustomerWithRoom();
    const b = await createCustomerWithRoom();

    const res = await request(app)
      .get(`/api/public/chat/${a.room.id}`)
      .set('X-Visitor-Token', b.visitorToken);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('없는 상담방은 404 를 반환한다', async () => {
    const { visitorToken } = await createCustomerWithRoom();

    const res = await request(app)
      .get('/api/public/chat/00000000-0000-0000-0000-000000000000')
      .set('X-Visitor-Token', visitorToken);

    expect(res.status).toBe(404);
  });

  it('고객 응답에는 전화번호가 포함되지 않는다', async () => {
    const { room, visitorToken } = await createCustomerWithRoom({ phone: '+81 90-9999-8888' });

    const res = await request(app)
      .get(`/api/public/chat/${room.id}`)
      .set('X-Visitor-Token', visitorToken);

    expect(JSON.stringify(res.body)).not.toContain('90-9999-8888');
  });
});

describe('POST /api/public/chat/:roomId/messages', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('고객 메시지를 저장하고 DTO 를 반환한다', async () => {
    const { room, visitorToken } = await createCustomerWithRoom();

    const res = await request(app)
      .post(`/api/public/chat/${room.id}/messages`)
      .set('X-Visitor-Token', visitorToken)
      .send({ text: 'ホテルの予約もお願いできますか。', clientMessageId: 'client-1' });

    expect(res.status).toBe(201);
    expect(res.body.message.senderType).toBe('customer');
    expect(res.body.message.visibleText).toBe('ホテルの予約もお願いできますか。');
    expect(res.body.message.clientMessageId).toBe('client-1');
  });

  it('같은 clientMessageId 를 두 번 보내도 메시지는 하나만 저장된다', async () => {
    const { room, visitorToken } = await createCustomerWithRoom();
    const body = { text: '중복 테스트', clientMessageId: 'dup-1' };

    const first = await request(app)
      .post(`/api/public/chat/${room.id}/messages`)
      .set('X-Visitor-Token', visitorToken)
      .send(body);
    const second = await request(app)
      .post(`/api/public/chat/${room.id}/messages`)
      .set('X-Visitor-Token', visitorToken)
      .send(body);

    expect(second.status).toBe(201);
    expect(second.body.message.id).toBe(first.body.message.id);
    // AI 상담 봇이 실패 시 운영자 전환 안내를 남길 수 있으므로(OPENAI_API_KEY 없음),
    // 전체 메시지 수가 아니라 "고객 메시지가 중복 저장되지 않았는지"만 확인한다.
    expect(
      await prisma.message.count({ where: { chatRoomId: room.id, senderType: 'customer' } })
    ).toBe(1);
  });

  it('메시지를 저장하면 상담방의 lastMessageAt 이 갱신된다', async () => {
    const { room, visitorToken } = await createCustomerWithRoom();
    expect(room.lastMessageAt).toBeNull();

    await request(app)
      .post(`/api/public/chat/${room.id}/messages`)
      .set('X-Visitor-Token', visitorToken)
      .send({ text: '안녕하세요' });

    const updated = await prisma.chatRoom.findUniqueOrThrow({ where: { id: room.id } });
    expect(updated.lastMessageAt).not.toBeNull();
  });

  it('종료된 상담방에는 메시지를 보낼 수 없다', async () => {
    const { room, visitorToken } = await createCustomerWithRoom({ status: 'closed' });

    const res = await request(app)
      .post(`/api/public/chat/${room.id}/messages`)
      .set('X-Visitor-Token', visitorToken)
      .send({ text: '종료 후 메시지' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ROOM_CLOSED');
  });

  it('빈 메시지는 400 을 반환한다', async () => {
    const { room, visitorToken } = await createCustomerWithRoom();

    const res = await request(app)
      .post(`/api/public/chat/${room.id}/messages`)
      .set('X-Visitor-Token', visitorToken)
      .send({ text: '   ' });

    expect(res.status).toBe(400);
  });
});
