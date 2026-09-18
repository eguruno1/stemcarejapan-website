import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createSocketServer } from '../src/realtime/socketServer';
import { createCustomerWithRoom, createOperator } from './helpers/factories';
import { disconnectDatabase, resetDatabase } from './helpers/testDb';

let httpServer: HttpServer;
let baseUrl: string;
const app = createApp();
const openSockets: ClientSocket[] = [];

function connect(auth: Record<string, unknown>): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(baseUrl, { auth, transports: ['websocket'], reconnection: false });
    openSockets.push(socket);
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

function waitFor<T>(socket: ClientSocket, event: string, timeoutMs = 4000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} 없음`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

beforeAll(async () => {
  httpServer = createServer(app);
  createSocketServer(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  baseUrl = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await disconnectDatabase();
});

beforeEach(async () => {
  await resetDatabase();
});

afterEach(() => {
  while (openSockets.length > 0) openSockets.pop()?.disconnect();
});

describe('HTTP → 소켓 전파', () => {
  it('운영자가 HTTP 로 배정하면 고객 소켓이 상태 변경을 받는다', async () => {
    const { plainPassword } = await createOperator({ email: 'bridge@stemcare.test' });
    const { room, visitorToken } = await createCustomerWithRoom({ status: 'waiting' });

    const customerSocket = await connect({ roomId: room.id, visitorToken });
    customerSocket.emit('chat:join', { roomId: room.id });
    await waitFor(customerSocket, 'chat:joined');

    const agent = request.agent(baseUrl);
    await agent
      .post('/api/admin/auth/login')
      .send({ email: 'bridge@stemcare.test', password: plainPassword });

    const statusEvent = waitFor<{ status: string }>(customerSocket, 'chat:status');
    await agent.patch(`/api/admin/chat-rooms/${room.id}/assign`).expect(200);

    expect((await statusEvent).status).toBe('active');
  });

  it('운영자가 HTTP 로 보낸 메시지가 고객 소켓에 도착한다', async () => {
    const { plainPassword } = await createOperator({ email: 'msg@stemcare.test' });
    const { room, visitorToken } = await createCustomerWithRoom({ status: 'active' });

    const customerSocket = await connect({ roomId: room.id, visitorToken });
    customerSocket.emit('chat:join', { roomId: room.id });
    await waitFor(customerSocket, 'chat:joined');

    const agent = request.agent(baseUrl);
    await agent.post('/api/admin/auth/login').send({ email: 'msg@stemcare.test', password: plainPassword });

    const received = waitFor<{ message: { visibleText: string } }>(customerSocket, 'chat:message');
    await agent
      .post(`/api/admin/chat-rooms/${room.id}/messages`)
      .send({ originalText: '방문 예정일을 알려주세요.', originalLanguage: 'ko' })
      .expect(201);

    expect((await received).message.visibleText).toBe('방문 예정일을 알려주세요.');
  });

  it('새 상담이 접수되면 운영자에게 rooms:new 가 간다', async () => {
    const { operator } = await createOperator();
    const { signOperatorToken } = await import('../src/auth/token');
    const operatorSocket = await connect({
      operatorToken: signOperatorToken({ operatorId: operator.id, role: 'operator' })
    });

    const notified = waitFor<{ roomId: string }>(operatorSocket, 'rooms:new');
    await request(baseUrl)
      .post('/api/public/chat/start')
      .send({
        name: '신규 고객',
        phone: '010-1111-2222',
        preferredLanguage: 'ko',
        serviceType: 'korea_travel',
        privacyAgreed: true
      })
      .expect(201);

    expect((await notified).roomId).toEqual(expect.any(String));
  });

  it('고객이 HTTP 로 보낸 메시지도 운영자 소켓에 도착한다', async () => {
    const { operator } = await createOperator();
    const { signOperatorToken } = await import('../src/auth/token');
    const { room, visitorToken } = await createCustomerWithRoom();

    const operatorSocket = await connect({
      operatorToken: signOperatorToken({ operatorId: operator.id, role: 'operator' })
    });
    operatorSocket.emit('chat:join', { roomId: room.id });
    await waitFor(operatorSocket, 'chat:joined');

    const received = waitFor<{ message: { visibleText: string } }>(operatorSocket, 'chat:message');
    await request(baseUrl)
      .post(`/api/public/chat/${room.id}/messages`)
      .set('X-Visitor-Token', visitorToken)
      .send({ text: 'HTTP 폴백 메시지' })
      .expect(201);

    expect((await received).message.visibleText).toBe('HTTP 폴백 메시지');
  });

  it('상담을 종료하면 고객 소켓도 종료 안내와 상태를 받는다', async () => {
    const { plainPassword } = await createOperator({ email: 'close@stemcare.test' });
    const { room, visitorToken } = await createCustomerWithRoom({ status: 'active' });

    const customerSocket = await connect({ roomId: room.id, visitorToken });
    customerSocket.emit('chat:join', { roomId: room.id });
    await waitFor(customerSocket, 'chat:joined');

    const agent = request.agent(baseUrl);
    await agent.post('/api/admin/auth/login').send({ email: 'close@stemcare.test', password: plainPassword });

    const statusEvent = waitFor<{ status: string }>(customerSocket, 'chat:status');
    const noticeEvent = waitFor<{ message: { senderType: string } }>(customerSocket, 'chat:message');
    await agent.patch(`/api/admin/chat-rooms/${room.id}/status`).send({ status: 'closed' }).expect(200);

    expect((await statusEvent).status).toBe('closed');
    expect((await noticeEvent).message.senderType).toBe('system');
  });
});

it('HTTP 폴백에서도 인계 요청은 waiting 전환과 시스템 메시지를 한 번만 생성한다', async () => {
  const { prisma } = await import('../src/db');
  const { room, visitorToken } = await createCustomerWithRoom();
  const url = `/api/public/chat/${room.id}/handoff`;
  await request(baseUrl).post(url).expect(401);
  const first = await request(baseUrl).post(url).set('X-Visitor-Token', visitorToken).expect(200);
  expect(first.body.status).toBe('waiting');
  await request(baseUrl).post(url).set('X-Visitor-Token', visitorToken).expect(200);
  expect(await prisma.message.count({ where: { chatRoomId: room.id, senderType: 'system' } })).toBe(1);
});
