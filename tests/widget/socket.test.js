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
  socketModule.disconnectSocket();
  vi.useRealTimers();
  delete window.io;
});

it('chat:error 에 clientMessageId 가 실려 오면 해당 pending 말풍선만 실패로 표시한다', async () => {
  const connectPromise = socketModule.connectSocket();
  fakeSocket.__fire('connect');
  fakeSocket.__fire('chat:joined', { roomId: 'room-1', status: 'active', messages: [] });
  await connectPromise;

  state.addPendingMessage({ clientMessageId: 'stuck-1', text: '테스트' });
  expect(state.getPendingMessage('stuck-1').status).toBe('sending');

  fakeSocket.__fire('chat:error', { code: 'ROOM_CLOSED', message: '종료됨', clientMessageId: 'stuck-1' });

  expect(state.getPendingMessage('stuck-1').status).toBe('failed');
});

it('clientMessageId 가 없는 chat:error 는 어떤 pending 도 건드리지 않는다', async () => {
  const connectPromise = socketModule.connectSocket();
  fakeSocket.__fire('connect');
  fakeSocket.__fire('chat:joined', { roomId: 'room-1', status: 'active', messages: [] });
  await connectPromise;

  state.addPendingMessage({ clientMessageId: 'safe-1', text: '테스트' });

  fakeSocket.__fire('chat:error', { code: 'VALIDATION_ERROR', message: '오류' });

  expect(state.getPendingMessage('safe-1').status).toBe('sending');
});

it('이전 세션의 늦은 이벤트는 새 고객 상태에 반영하지 않는다', async () => {
  const connecting = socketModule.connectSocket();
  fakeSocket.__fire('connect');
  fakeSocket.__fire('chat:joined', { roomId: 'room-1', status: 'active', messages: [] });
  await connecting;
  state.clearSession();
  state.saveSession({ roomId: 'room-2', visitorToken: 'token-2' });
  fakeSocket.__fire('chat:message', { message: { id: 'private', chatRoomId: 'room-1' } });
  fakeSocket.__fire('chat:status', { roomId: 'room-1', status: 'closed' });
  expect(state.getState().messages).toEqual([]);
  expect(state.getState().room).toBeNull();
});

it('재시도 가능한 초기 연결 오류에도 5초 제한이 유지된다', async () => {
  vi.useFakeTimers();
  const connecting = socketModule.connectSocket();
  const rejected = expect(connecting).rejects.toThrow();
  fakeSocket.__fire('connect_error', new Error('offline'));
  await vi.advanceTimersByTimeAsync(5000);
  await rejected;
  expect(fakeSocket.disconnect).toHaveBeenCalled();
});

it('ack 유실 시 전송 중 말풍선이 재시도 가능한 실패 상태가 된다', async () => {
  vi.useFakeTimers();
  const connecting = socketModule.connectSocket();
  fakeSocket.__fire('connect');
  fakeSocket.__fire('chat:joined', { roomId: 'room-1', status: 'active', messages: [] });
  await connecting;
  state.addPendingMessage({ clientMessageId: 'lost', text: '전송' });
  socketModule.sendViaSocket({ clientMessageId: 'lost', text: '전송' });
  await vi.advanceTimersByTimeAsync(8000);
  expect(state.getPendingMessage('lost').status).toBe('failed');
});

it('입력 종료 신호가 유실돼도 입력 중 표시는 만료된다', async () => {
  vi.useFakeTimers();
  const connecting = socketModule.connectSocket();
  fakeSocket.__fire('connect');
  fakeSocket.__fire('chat:joined', { roomId: 'room-1', status: 'active', messages: [] });
  await connecting;
  fakeSocket.__fire('chat:typing', { roomId: 'room-1', from: 'operator', isTyping: true });
  expect(state.getState().peerTyping).toBe(true);
  await vi.advanceTimersByTimeAsync(3000);
  expect(state.getState().peerTyping).toBe(false);
});
