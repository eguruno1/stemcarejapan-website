import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/db';
import { createMessage } from '../src/messages/messageService';
import { createCustomerWithRoom, createOperator } from './helpers/factories';
import { disconnectDatabase, resetDatabase } from './helpers/testDb';

const app = createApp();

async function loginAgent() {
  const { plainPassword } = await createOperator({ email: 'hist@stemcare.test' });
  const agent = request.agent(app);
  await agent
    .post('/api/admin/auth/login')
    .send({ email: 'hist@stemcare.test', password: plainPassword });
  return agent;
}

/** 같은 고객에게 상담방을 하나 더 만들어 준다. */
async function addRoomForCustomer(
  customerId: string,
  overrides: { status?: string; serviceType?: string } = {}
) {
  const { createVisitorToken, hashVisitorToken } = await import('../src/auth/token');
  const status = overrides.status ?? 'closed';
  return prisma.chatRoom.create({
    data: {
      customerId,
      serviceType: overrides.serviceType ?? 'korea_travel',
      status,
      closedAt: status === 'closed' ? new Date() : null,
      visitorTokenHash: hashVisitorToken(createVisitorToken())
    }
  });
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await disconnectDatabase();
});

describe('GET /api/admin/chat-rooms/:roomId/customer-history', () => {
  it('로그인하지 않으면 401 이다', async () => {
    const { room } = await createCustomerWithRoom();

    const res = await request(app).get(`/api/admin/chat-rooms/${room.id}/customer-history`);

    expect(res.status).toBe(401);
  });

  it('같은 고객의 지난 상담을 돌려준다', async () => {
    const agent = await loginAgent();
    const { customer, room } = await createCustomerWithRoom();
    await addRoomForCustomer(customer.id, { serviceType: 'stemcell' });

    const res = await agent.get(`/api/admin/chat-rooms/${room.id}/customer-history`);

    expect(res.status).toBe(200);
    expect(res.body.history).toHaveLength(1);
    expect(res.body.history[0].serviceType).toBe('stemcell');
    expect(res.body.history[0].status).toBe('closed');
  });

  it('지금 보고 있는 상담방은 이력에서 제외한다', async () => {
    const agent = await loginAgent();
    const { customer, room } = await createCustomerWithRoom();
    await addRoomForCustomer(customer.id);

    const res = await agent.get(`/api/admin/chat-rooms/${room.id}/customer-history`);

    expect(res.body.history.map((item: { roomId: string }) => item.roomId)).not.toContain(room.id);
  });

  it('다른 고객의 상담은 섞이지 않는다', async () => {
    const agent = await loginAgent();
    const mine = await createCustomerWithRoom({ name: '야마다' });
    const other = await createCustomerWithRoom({ name: '스즈키' });
    await addRoomForCustomer(other.customer.id);

    const res = await agent.get(`/api/admin/chat-rooms/${mine.room.id}/customer-history`);

    expect(res.body.history).toHaveLength(0);
  });

  it('각 상담의 메시지 수를 함께 준다', async () => {
    const agent = await loginAgent();
    const { customer, room } = await createCustomerWithRoom();
    // 종료된 방에는 메시지를 넣을 수 없으므로 진행 중 상태로 만든다.
    const past = await addRoomForCustomer(customer.id, { status: 'active' });
    await createMessage({
      chatRoomId: past.id,
      senderType: 'customer',
      senderId: customer.id,
      text: '지난 문의 1',
      originalLanguage: 'ko'
    });
    await createMessage({
      chatRoomId: past.id,
      senderType: 'operator',
      text: '지난 답변 1',
      originalLanguage: 'ko'
    });

    const res = await agent.get(`/api/admin/chat-rooms/${room.id}/customer-history`);

    expect(res.body.history[0].messageCount).toBe(2);
  });

  it('최근 상담이 먼저 온다', async () => {
    const agent = await loginAgent();
    const { customer, room } = await createCustomerWithRoom();
    const older = await addRoomForCustomer(customer.id, { serviceType: 'stemcell' });
    await prisma.chatRoom.update({
      where: { id: older.id },
      data: { createdAt: new Date('2026-01-01') }
    });
    const newer = await addRoomForCustomer(customer.id, { serviceType: 'undecided' });
    await prisma.chatRoom.update({
      where: { id: newer.id },
      data: { createdAt: new Date('2026-08-01') }
    });

    const res = await agent.get(`/api/admin/chat-rooms/${room.id}/customer-history`);

    expect(res.body.history[0].serviceType).toBe('undecided');
    expect(res.body.history[1].serviceType).toBe('stemcell');
  });

  it('지난 상담이 없으면 빈 배열이다', async () => {
    const agent = await loginAgent();
    const { room } = await createCustomerWithRoom();

    const res = await agent.get(`/api/admin/chat-rooms/${room.id}/customer-history`);

    expect(res.body.history).toEqual([]);
  });

  it('없는 상담방은 404 다', async () => {
    const agent = await loginAgent();

    const res = await agent.get(
      '/api/admin/chat-rooms/00000000-0000-0000-0000-000000000000/customer-history'
    );

    expect(res.status).toBe(404);
  });
});
