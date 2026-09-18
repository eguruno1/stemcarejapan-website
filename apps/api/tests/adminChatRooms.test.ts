import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/db';
import { createMessage } from '../src/messages/messageService';
import { createCustomerWithRoom, createOperator } from './helpers/factories';
import { disconnectDatabase, resetDatabase } from './helpers/testDb';

const app = createApp();

async function loginAgent(email = 'op@stemcare.test') {
  const { operator, plainPassword } = await createOperator({ email });
  const agent = request.agent(app);
  await agent.post('/api/admin/auth/login').send({ email, password: plainPassword });
  return { agent, operator };
}

describe('GET /api/admin/chat-rooms', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('로그인하지 않으면 401 이다', async () => {
    const res = await request(app).get('/api/admin/chat-rooms');

    expect(res.status).toBe(401);
  });

  it('상담 목록을 최근 메시지 순으로 반환한다', async () => {
    const { agent } = await loginAgent();
    const older = await createCustomerWithRoom({ name: '오래된 고객' });
    const newer = await createCustomerWithRoom({ name: '최근 고객' });

    await createMessage({ chatRoomId: older.room.id, senderType: 'customer', text: '먼저' });
    await createMessage({ chatRoomId: newer.room.id, senderType: 'customer', text: '나중' });

    const res = await agent.get('/api/admin/chat-rooms');

    expect(res.status).toBe(200);
    expect(res.body.rooms).toHaveLength(2);
    expect(res.body.rooms[0].customerName).toBe('최근 고객');
    expect(res.body.rooms[0].lastMessagePreview).toBe('나중');
  });

  it('status 로 필터링할 수 있다', async () => {
    const { agent } = await loginAgent();
    await createCustomerWithRoom({ name: '봇 상담', status: 'bot' });
    await createCustomerWithRoom({ name: '대기 상담', status: 'waiting' });

    const res = await agent.get('/api/admin/chat-rooms?status=waiting');

    expect(res.body.rooms).toHaveLength(1);
    expect(res.body.rooms[0].customerName).toBe('대기 상담');
  });

  it('알 수 없는 status 값은 400 이다', async () => {
    const { agent } = await loginAgent();

    const res = await agent.get('/api/admin/chat-rooms?status=이상한값');

    expect(res.status).toBe(400);
  });

  it('운영자가 아직 읽지 않은 고객 메시지 수를 unreadCount 로 준다', async () => {
    const { agent } = await loginAgent();
    const { room } = await createCustomerWithRoom();

    await createMessage({ chatRoomId: room.id, senderType: 'customer', text: '첫 번째' });
    await createMessage({ chatRoomId: room.id, senderType: 'customer', text: '두 번째' });
    await createMessage({ chatRoomId: room.id, senderType: 'operator', text: '운영자 답변' });

    const res = await agent.get('/api/admin/chat-rooms');

    // 운영자 메시지는 unread 에 포함하지 않는다.
    expect(res.body.rooms[0].unreadCount).toBe(2);
  });
});

describe('GET /api/admin/chat-rooms/:roomId', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('상담 상세에 고객 정보와 전체 메시지가 들어 있다', async () => {
    const { agent } = await loginAgent();
    const { room, customer } = await createCustomerWithRoom({ phone: '+81 90-5555-6666' });
    await createMessage({ chatRoomId: room.id, senderType: 'customer', text: '문의합니다' });

    const res = await agent.get(`/api/admin/chat-rooms/${room.id}`);

    expect(res.status).toBe(200);
    expect(res.body.room.id).toBe(room.id);
    expect(res.body.room.customer.name).toBe(customer.name);
    // 운영자는 개인정보를 볼 수 있어야 한다.
    expect(res.body.room.customer.phone).toBe('+81 90-5555-6666');
    expect(res.body.room.messages).toHaveLength(1);
    expect(res.body.room.notes).toEqual([]);
    expect(res.body.room.summary).toBeNull();
  });

  it('상세를 열면 operatorLastReadAt 이 갱신되어 unread 가 0 이 된다', async () => {
    const { agent } = await loginAgent();
    const { room } = await createCustomerWithRoom();
    await createMessage({ chatRoomId: room.id, senderType: 'customer', text: '읽지 않음' });

    await agent.get(`/api/admin/chat-rooms/${room.id}`);
    const list = await agent.get('/api/admin/chat-rooms');

    expect(list.body.rooms[0].unreadCount).toBe(0);
    const updated = await prisma.chatRoom.findUniqueOrThrow({ where: { id: room.id } });
    expect(updated.operatorLastReadAt).not.toBeNull();
  });

  it('없는 상담방은 404 이다', async () => {
    const { agent } = await loginAgent();

    const res = await agent.get('/api/admin/chat-rooms/00000000-0000-0000-0000-000000000000');

    expect(res.status).toBe(404);
  });

  it('로그인하지 않으면 401 이다', async () => {
    const { room } = await createCustomerWithRoom();

    const res = await request(app).get(`/api/admin/chat-rooms/${room.id}`);

    expect(res.status).toBe(401);
  });
});
