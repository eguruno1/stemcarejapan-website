import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { signOperatorToken } from '../src/auth/token';
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

describe('unread 실시간 처리', () => {
  it('운영자가 방에 들어와 있으면 새 고객 메시지가 unread 로 쌓이지 않는다', async () => {
    const { operator, plainPassword } = await createOperator({ email: 'unread@stemcare.test' });
    const { room, visitorToken } = await createCustomerWithRoom();

    const operatorSocket = await connect({
      operatorToken: signOperatorToken({ operatorId: operator.id, role: 'operator' })
    });
    operatorSocket.emit('chat:join', { roomId: room.id });
    await waitFor(operatorSocket, 'chat:joined');

    const customerSocket = await connect({ roomId: room.id, visitorToken });
    customerSocket.emit('chat:join', { roomId: room.id });
    await waitFor(customerSocket, 'chat:joined');

    const delivered = waitFor(operatorSocket, 'chat:message');
    customerSocket.emit('chat:message', { roomId: room.id, text: '읽음 처리 확인', clientMessageId: 'u-1' });
    await delivered;

    const agent = request.agent(baseUrl);
    await agent.post('/api/admin/auth/login').send({ email: 'unread@stemcare.test', password: plainPassword });
    const list = await agent.get('/api/admin/chat-rooms');

    expect(list.body.rooms[0].unreadCount).toBe(0);
  });

  it('운영자가 방에 없으면 unread 가 쌓인다', async () => {
    const { plainPassword } = await createOperator({ email: 'away@stemcare.test' });
    const { room, visitorToken } = await createCustomerWithRoom();

    const customerSocket = await connect({ roomId: room.id, visitorToken });
    customerSocket.emit('chat:join', { roomId: room.id });
    await waitFor(customerSocket, 'chat:joined');

    const ack = waitFor(customerSocket, 'chat:message:ack');
    customerSocket.emit('chat:message', { roomId: room.id, text: '아무도 없음', clientMessageId: 'u-2' });
    await ack;

    const agent = request.agent(baseUrl);
    await agent.post('/api/admin/auth/login').send({ email: 'away@stemcare.test', password: plainPassword });
    const list = await agent.get('/api/admin/chat-rooms');

    expect(list.body.rooms[0].unreadCount).toBe(1);
  });
});

it('지연된 읽음 처리는 전달한 메시지 이후의 메시지를 읽거나 시각을 되돌리지 않는다', async () => {
  const { markDeliveredRead, listRooms } = await import('../src/chatRooms/chatRoomService');
  const { createMessageRow } = await import('../src/messages/messageService');
  const { prisma } = await import('../src/db');
  const { room, customer } = await createCustomerWithRoom();
  const first = await createMessageRow({ chatRoomId: room.id, senderType: 'customer', senderId: customer.id, text: '첫째' });
  const second = await createMessageRow({ chatRoomId: room.id, senderType: 'customer', senderId: customer.id, text: '둘째' });
  await markDeliveredRead(room.id, first.createdAt);
  expect((await listRooms())[0].unreadCount).toBe(1);
  await markDeliveredRead(room.id, second.createdAt);
  await markDeliveredRead(room.id, first.createdAt);
  expect((await prisma.chatRoom.findUniqueOrThrow({ where: { id: room.id } })).operatorLastReadAt).toEqual(second.createdAt);
});

it('다른 방으로 이동한 운영자는 이전 방 고객 메시지를 읽음 처리하지 않는다', async () => {
  const { listRooms } = await import('../src/chatRooms/chatRoomService');
  const { operator } = await createOperator();
  const a = await createCustomerWithRoom();
  const b = await createCustomerWithRoom();
  const op = await connect({ operatorToken: signOperatorToken({ operatorId: operator.id, role: 'operator' }) });
  op.emit('chat:join', { roomId: a.room.id }); await waitFor(op, 'chat:joined');
  op.emit('chat:join', { roomId: b.room.id }); await waitFor(op, 'chat:joined');
  const customer = await connect({ roomId: a.room.id, visitorToken: a.visitorToken });
  const ack = waitFor(customer, 'chat:message:ack');
  customer.emit('chat:message', { roomId: a.room.id, text: '부재중', clientMessageId: 'away' });
  await ack;
  expect((await listRooms()).find(r => r.id === a.room.id)?.unreadCount).toBe(1);
});
