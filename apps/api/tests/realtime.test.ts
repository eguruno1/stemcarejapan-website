import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { signOperatorToken } from '../src/auth/token';
import { createSocketServer } from '../src/realtime/socketServer';
import { createCustomerWithRoom, createOperator } from './helpers/factories';
import { disconnectDatabase, resetDatabase } from './helpers/testDb';

let httpServer: HttpServer;
let baseUrl: string;
const openSockets: ClientSocket[] = [];

/** 테스트용 소켓을 열고, 연결 성공/실패를 기다린다. */
function connect(auth: Record<string, unknown>): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(baseUrl, { auth, transports: ['websocket'], reconnection: false });
    openSockets.push(socket);
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err) => reject(err));
  });
}

/** 특정 이벤트가 올 때까지 기다린다. */
function waitFor<T>(socket: ClientSocket, event: string, timeoutMs = 4000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} 이벤트가 오지 않았습니다.`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

beforeAll(async () => {
  httpServer = createServer(createApp());
  createSocketServer(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address() as AddressInfo;
  baseUrl = `http://localhost:${port}`;
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

describe('소켓 연결 인증', () => {
  it('토큰이 없으면 연결이 거부된다', async () => {
    await expect(connect({})).rejects.toThrow();
  });

  it('잘못된 visitorToken 은 연결이 거부된다', async () => {
    const { room } = await createCustomerWithRoom();

    await expect(connect({ roomId: room.id, visitorToken: '틀린토큰' })).rejects.toThrow();
  });

  it('올바른 visitorToken 이면 고객으로 연결된다', async () => {
    const { room, visitorToken } = await createCustomerWithRoom();

    const socket = await connect({ roomId: room.id, visitorToken });

    expect(socket.connected).toBe(true);
  });

  it('조작된 운영자 JWT 는 연결이 거부된다', async () => {
    await expect(connect({ operatorToken: 'not-a-real-jwt' })).rejects.toThrow();
  });

  it('올바른 운영자 JWT 면 운영자로 연결된다', async () => {
    const { operator } = await createOperator();
    const token = signOperatorToken({ operatorId: operator.id, role: 'operator' });

    const socket = await connect({ operatorToken: token });

    expect(socket.connected).toBe(true);
  });

  it('비활성화된 운영자는 유효한 JWT 로도 연결이 거부된다', async () => {
    const { operator } = await createOperator({ isActive: false });
    const token = signOperatorToken({ operatorId: operator.id, role: 'operator' });

    await expect(connect({ operatorToken: token })).rejects.toThrow();
  });
});

describe('chat:join', () => {
  it('고객은 자기 상담방에 입장하고 기존 메시지를 받는다', async () => {
    const { room, visitorToken } = await createCustomerWithRoom();
    const socket = await connect({ roomId: room.id, visitorToken });

    socket.emit('chat:join', { roomId: room.id });
    const payload = await waitFor<{ roomId: string; status: string; messages: unknown[] }>(
      socket,
      'chat:joined'
    );

    expect(payload.roomId).toBe(room.id);
    expect(payload.status).toBe('bot');
    expect(Array.isArray(payload.messages)).toBe(true);
  });

  it('고객은 남의 상담방에 입장할 수 없다', async () => {
    const mine = await createCustomerWithRoom();
    const other = await createCustomerWithRoom();
    const socket = await connect({ roomId: mine.room.id, visitorToken: mine.visitorToken });

    socket.emit('chat:join', { roomId: other.room.id });
    const error = await waitFor<{ code: string }>(socket, 'chat:error');

    expect(error.code).toBe('FORBIDDEN');
  });

  it('운영자는 아무 상담방에나 입장할 수 있다', async () => {
    const { operator } = await createOperator();
    const { room } = await createCustomerWithRoom();
    const socket = await connect({
      operatorToken: signOperatorToken({ operatorId: operator.id, role: 'operator' })
    });

    socket.emit('chat:join', { roomId: room.id });
    const payload = await waitFor<{ roomId: string }>(socket, 'chat:joined');

    expect(payload.roomId).toBe(room.id);
  });

  it('없는 상담방에 입장하면 NOT_FOUND 다', async () => {
    const { operator } = await createOperator();
    const socket = await connect({
      operatorToken: signOperatorToken({ operatorId: operator.id, role: 'operator' })
    });

    socket.emit('chat:join', { roomId: '00000000-0000-0000-0000-000000000000' });
    const error = await waitFor<{ code: string }>(socket, 'chat:error');

    expect(error.code).toBe('NOT_FOUND');
  });
});

describe('chat:message', () => {
  it('고객 메시지가 저장되고 같은 방의 운영자에게 전달된다', async () => {
    const { operator } = await createOperator();
    const { room, visitorToken } = await createCustomerWithRoom();

    const customerSocket = await connect({ roomId: room.id, visitorToken });
    const operatorSocket = await connect({
      operatorToken: signOperatorToken({ operatorId: operator.id, role: 'operator' })
    });

    customerSocket.emit('chat:join', { roomId: room.id });
    await waitFor(customerSocket, 'chat:joined');
    operatorSocket.emit('chat:join', { roomId: room.id });
    await waitFor(operatorSocket, 'chat:joined');

    const received = waitFor<{ message: { visibleText: string; senderType: string } }>(
      operatorSocket,
      'chat:message'
    );
    customerSocket.emit('chat:message', {
      roomId: room.id,
      text: 'ホテルの予約もお願いできますか。',
      clientMessageId: 'c-1'
    });

    const payload = await received;
    expect(payload.message.senderType).toBe('customer');
    expect(payload.message.visibleText).toBe('ホテルの予約もお願いできますか。');
  });

  it('보낸 사람은 ack 를 받는다', async () => {
    const { room, visitorToken } = await createCustomerWithRoom();
    const socket = await connect({ roomId: room.id, visitorToken });
    socket.emit('chat:join', { roomId: room.id });
    await waitFor(socket, 'chat:joined');

    const ack = waitFor<{ clientMessageId: string; message: { id: string } }>(
      socket,
      'chat:message:ack'
    );
    socket.emit('chat:message', { roomId: room.id, text: '안녕하세요', clientMessageId: 'c-2' });

    const payload = await ack;
    expect(payload.clientMessageId).toBe('c-2');
    expect(payload.message.id).toEqual(expect.any(String));
  });

  it('같은 clientMessageId 를 두 번 보내도 메시지는 하나만 저장된다', async () => {
    const { prisma } = await import('../src/db');
    const { room, visitorToken } = await createCustomerWithRoom();
    const socket = await connect({ roomId: room.id, visitorToken });
    socket.emit('chat:join', { roomId: room.id });
    await waitFor(socket, 'chat:joined');

    socket.emit('chat:message', { roomId: room.id, text: '중복', clientMessageId: 'dup' });
    await waitFor(socket, 'chat:message:ack');
    socket.emit('chat:message', { roomId: room.id, text: '중복', clientMessageId: 'dup' });
    await waitFor(socket, 'chat:message:ack');

    expect(await prisma.message.count({ where: { chatRoomId: room.id } })).toBe(1);
  });

  it('빈 메시지는 오류를 돌려준다', async () => {
    const { room, visitorToken } = await createCustomerWithRoom();
    const socket = await connect({ roomId: room.id, visitorToken });
    socket.emit('chat:join', { roomId: room.id });
    await waitFor(socket, 'chat:joined');

    socket.emit('chat:message', { roomId: room.id, text: '   ', clientMessageId: 'e-1' });
    const error = await waitFor<{ code: string }>(socket, 'chat:error');

    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('종료된 상담에는 메시지를 보낼 수 없다', async () => {
    const { room, visitorToken } = await createCustomerWithRoom({ status: 'closed' });
    const socket = await connect({ roomId: room.id, visitorToken });
    socket.emit('chat:join', { roomId: room.id });
    await waitFor(socket, 'chat:joined');

    socket.emit('chat:message', { roomId: room.id, text: '종료 후', clientMessageId: 'c-3' });
    const error = await waitFor<{ code: string }>(socket, 'chat:error');

    expect(error.code).toBe('ROOM_CLOSED');
  });

  it('다른 상담방으로는 메시지를 보낼 수 없다', async () => {
    const mine = await createCustomerWithRoom();
    const other = await createCustomerWithRoom();
    const socket = await connect({ roomId: mine.room.id, visitorToken: mine.visitorToken });
    socket.emit('chat:join', { roomId: mine.room.id });
    await waitFor(socket, 'chat:joined');

    socket.emit('chat:message', { roomId: other.room.id, text: '침입', clientMessageId: 'x-1' });
    const error = await waitFor<{ code: string }>(socket, 'chat:error');

    expect(error.code).toBe('FORBIDDEN');
  });

  it('고객에게 가는 메시지에는 운영자 내부 번역 정보가 없다', async () => {
    const { operator } = await createOperator();
    const { room, visitorToken } = await createCustomerWithRoom();

    const customerSocket = await connect({ roomId: room.id, visitorToken });
    const operatorSocket = await connect({
      operatorToken: signOperatorToken({ operatorId: operator.id, role: 'operator' })
    });
    customerSocket.emit('chat:join', { roomId: room.id });
    await waitFor(customerSocket, 'chat:joined');
    operatorSocket.emit('chat:join', { roomId: room.id });
    await waitFor(operatorSocket, 'chat:joined');

    const customerReceives = waitFor<{ message: { translatedText: string | null } }>(
      customerSocket,
      'chat:message'
    );
    operatorSocket.emit('chat:message', {
      roomId: room.id,
      text: '방문 예정일을 알려주세요.',
      clientMessageId: 'op-1'
    });

    const payload = await customerReceives;
    expect(payload.message.translatedText).toBeNull();
  });
});

describe('chat:handoff-request', () => {
  it('고객이 운영자 연결을 요청하면 상태가 waiting 이 된다', async () => {
    const { prisma } = await import('../src/db');
    const { room, visitorToken } = await createCustomerWithRoom({ status: 'bot' });
    const socket = await connect({ roomId: room.id, visitorToken });
    socket.emit('chat:join', { roomId: room.id });
    await waitFor(socket, 'chat:joined');

    const statusEvent = waitFor<{ status: string }>(socket, 'chat:status');
    socket.emit('chat:handoff-request', { roomId: room.id, reason: 'customer_requested' });

    expect((await statusEvent).status).toBe('waiting');
    const updated = await prisma.chatRoom.findUniqueOrThrow({ where: { id: room.id } });
    expect(updated.status).toBe('waiting');
  });

  it('이미 대기 중이면 안내 메시지를 반복하지 않는다', async () => {
    const { prisma } = await import('../src/db');
    const { room, visitorToken } = await createCustomerWithRoom({ status: 'waiting' });
    const socket = await connect({ roomId: room.id, visitorToken });
    socket.emit('chat:join', { roomId: room.id });
    await waitFor(socket, 'chat:joined');

    socket.emit('chat:handoff-request', { roomId: room.id });
    await new Promise((resolve) => setTimeout(resolve, 300));

    const count = await prisma.message.count({ where: { chatRoomId: room.id, senderType: 'system' } });
    expect(count).toBe(0);
  });

  it('종료된 상담에서는 요청할 수 없다', async () => {
    const { room, visitorToken } = await createCustomerWithRoom({ status: 'closed' });
    const socket = await connect({ roomId: room.id, visitorToken });
    socket.emit('chat:join', { roomId: room.id });
    await waitFor(socket, 'chat:joined');

    socket.emit('chat:handoff-request', { roomId: room.id });
    const error = await waitFor<{ code: string }>(socket, 'chat:error');

    expect(error.code).toBe('ROOM_CLOSED');
  });
});

describe('chat:typing', () => {
  it('입력 중 표시가 상대에게만 전달된다', async () => {
    const { operator } = await createOperator();
    const { room, visitorToken } = await createCustomerWithRoom();

    const customerSocket = await connect({ roomId: room.id, visitorToken });
    const operatorSocket = await connect({
      operatorToken: signOperatorToken({ operatorId: operator.id, role: 'operator' })
    });
    customerSocket.emit('chat:join', { roomId: room.id });
    await waitFor(customerSocket, 'chat:joined');
    operatorSocket.emit('chat:join', { roomId: room.id });
    await waitFor(operatorSocket, 'chat:joined');

    const typing = waitFor<{ from: string; isTyping: boolean }>(operatorSocket, 'chat:typing');
    customerSocket.emit('chat:typing', { roomId: room.id, isTyping: true });

    const payload = await typing;
    expect(payload.from).toBe('customer');
    expect(payload.isTyping).toBe(true);
  });
});
