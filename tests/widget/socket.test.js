import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/** window.io 를 흉내 낸 최소 가짜 소켓. connectSocket() 이 등록하는 핸들러만 흉내 낸다. */
function createFakeSocket() {
  const handlers = new Map();
  const socket = {
    connected: true,
    active: true,
    on(event, handler) {
      handlers.set(event, handler);
      return socket;
    },
    once() {
      return socket;
    },
    off() {
      return socket;
    },
    emit: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn(),
    io: { on: vi.fn() },
    // 테스트가 서버 이벤트를 흉내 낼 때 쓴다.
    __fire(event, payload) {
      handlers.get(event)?.(payload);
    }
  };
  return socket;
}

let state;
let socketModule;
let fakeSocket;

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();

  fakeSocket = createFakeSocket();
  window.io = vi.fn(() => fakeSocket);

  state = await import('../../js/chat/state.js');
  socketModule = await import('../../js/chat/socket.js');

  state.saveSession({ roomId: 'room-1', visitorToken: 'token-1' });
});

afterEach(() => {
  delete window.io;
});

it('chat:error 에 clientMessageId 가 실려 오면 해당 pending 말풍선만 실패로 표시한다', async () => {
  const connectPromise = socketModule.connectSocket();
  fakeSocket.__fire('connect');
  fakeSocket.__fire('chat:joined', { status: 'active', messages: [] });
  await connectPromise;

  state.addPendingMessage({ clientMessageId: 'stuck-1', text: '테스트' });
  expect(state.getPendingMessage('stuck-1').status).toBe('sending');

  fakeSocket.__fire('chat:error', { code: 'ROOM_CLOSED', message: '종료됨', clientMessageId: 'stuck-1' });

  expect(state.getPendingMessage('stuck-1').status).toBe('failed');
});

it('clientMessageId 가 없는 chat:error 는 어떤 pending 도 건드리지 않는다', async () => {
  const connectPromise = socketModule.connectSocket();
  fakeSocket.__fire('connect');
  fakeSocket.__fire('chat:joined', { status: 'active', messages: [] });
  await connectPromise;

  state.addPendingMessage({ clientMessageId: 'safe-1', text: '테스트' });

  fakeSocket.__fire('chat:error', { code: 'VALIDATION_ERROR', message: '오류' });

  expect(state.getPendingMessage('safe-1').status).toBe('sending');
});
