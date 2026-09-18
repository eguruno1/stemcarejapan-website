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
  httpServer = createServer(createApp());
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

describe('운영자 접속 상태', () => {
  it('고객이 입장하면 현재 접속 상태를 함께 받는다', async () => {
    const { room, visitorToken } = await createCustomerWithRoom();
    const socket = await connect({ roomId: room.id, visitorToken });

    socket.emit('chat:join', { roomId: room.id });
    const payload = await waitFor<{ anyOperatorOnline: boolean }>(socket, 'chat:presence');

    expect(payload.anyOperatorOnline).toBe(false);
  });

  it('운영자가 접속하면 고객에게 알림이 간다', async () => {
    const { operator } = await createOperator();
    const { room, visitorToken } = await createCustomerWithRoom();

    // chat:join 은 chat:joined 와 chat:presence 를 연달아 보낸다.
    // 순서대로 await 하면, 둘째 이벤트가 첫째를 처리하는 동안 이미 도착해
    // once() 등록 전에 지나가 버릴 수 있다. 리스너를 emit 전에 먼저 걸어둔다.
    const customerSocket = await connect({ roomId: room.id, visitorToken });
    const joined = waitFor(customerSocket, 'chat:joined');
    const initialPresence = waitFor(customerSocket, 'chat:presence');
    customerSocket.emit('chat:join', { roomId: room.id });
    await joined;
    await initialPresence;

    const presenceUpdate = waitFor<{ anyOperatorOnline: boolean }>(customerSocket, 'chat:presence');
    await connect({ operatorToken: signOperatorToken({ operatorId: operator.id, role: 'operator' }) });

    expect((await presenceUpdate).anyOperatorOnline).toBe(true);
  });

  it('운영자가 그 방에 들어오면 operatorOnline 이 true 가 된다', async () => {
    const { operator } = await createOperator();
    const { room, visitorToken } = await createCustomerWithRoom();

    const customerSocket = await connect({ roomId: room.id, visitorToken });
    const joined = waitFor(customerSocket, 'chat:joined');
    const initialPresence = waitFor(customerSocket, 'chat:presence');
    customerSocket.emit('chat:join', { roomId: room.id });
    await joined;
    await initialPresence;

    const operatorSocket = await connect({
      operatorToken: signOperatorToken({ operatorId: operator.id, role: 'operator' })
    });

    const inRoom = new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 4000);
      customerSocket.on('chat:presence', (payload: { operatorOnline: boolean }) => {
        if (payload.operatorOnline) {
          clearTimeout(timer);
          resolve(true);
        }
      });
    });

    operatorSocket.emit('chat:join', { roomId: room.id });

    expect(await inRoom).toBe(true);
  });

  it('운영자가 나가면 다시 false 가 된다', async () => {
    const { operator } = await createOperator();
    const { room, visitorToken } = await createCustomerWithRoom();

    const customerSocket = await connect({ roomId: room.id, visitorToken });
    const joined = waitFor(customerSocket, 'chat:joined');
    const initialPresence = waitFor(customerSocket, 'chat:presence');
    customerSocket.emit('chat:join', { roomId: room.id });
    await joined;
    await initialPresence;

    const operatorSocket = await connect({
      operatorToken: signOperatorToken({ operatorId: operator.id, role: 'operator' })
    });
    const operatorJoinedPresence = waitFor(customerSocket, 'chat:presence');
    operatorSocket.emit('chat:join', { roomId: room.id });
    await operatorJoinedPresence;

    const wentOffline = new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 4000);
      customerSocket.on('chat:presence', (payload: { anyOperatorOnline: boolean }) => {
        if (!payload.anyOperatorOnline) {
          clearTimeout(timer);
          resolve(true);
        }
      });
    });

    operatorSocket.disconnect();

    expect(await wentOffline).toBe(true);
  });

  it('다른 상담방 고객에게는 그 방의 운영자 입장이 전달되지 않는다', async () => {
    const { operator } = await createOperator();
    const watched = await createCustomerWithRoom();
    const other = await createCustomerWithRoom();

    const otherCustomer = await connect({
      roomId: other.room.id,
      visitorToken: other.visitorToken
    });
    const otherJoined = waitFor(otherCustomer, 'chat:joined');
    const otherInitialPresence = waitFor(otherCustomer, 'chat:presence');
    otherCustomer.emit('chat:join', { roomId: other.room.id });
    await otherJoined;
    await otherInitialPresence;

    const operatorSocket = await connect({
      operatorToken: signOperatorToken({ operatorId: operator.id, role: 'operator' })
    });
    // 감시 대상이 아닌 방에만 들어간다.
    operatorSocket.emit('chat:join', { roomId: watched.room.id });

    // other 방의 고객은 operatorOnline=true 를 받으면 안 된다.
    const gotRoomPresence = await new Promise<boolean>((resolve) => {
      let sawInRoom = false;
      const handler = (payload: { operatorOnline: boolean }) => {
        if (payload.operatorOnline) sawInRoom = true;
      };
      otherCustomer.on('chat:presence', handler);
      setTimeout(() => {
        otherCustomer.off('chat:presence', handler);
        resolve(sawInRoom);
      }, 800);
    });

    expect(gotRoomPresence).toBe(false);
  });
});
