import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('../../js/chat/poller.js', () => ({
  pollOnce: vi.fn(),
  startPolling: vi.fn(),
  stopPolling: vi.fn()
}));

let state;
let stream;
let poller;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  localStorage.clear();
  delete window.io;

  state = await import('../../js/chat/state.js');
  stream = await import('../../js/chat/stream.js');
  poller = await import('../../js/chat/poller.js');

  state.saveSession({ roomId: 'room-1', visitorToken: 'token-1' });
});

afterEach(() => {
  stream.stopStream();
});

it('window.io 가 없으면 폴링으로 대체한다', async () => {
  await stream.startStream({ onFatalError: vi.fn() });

  expect(stream.isRealtime()).toBe(false);
  expect(poller.startPolling).toHaveBeenCalledTimes(1);
  expect(state.getState().transport).toBe('polling');
});

it('폴링 모드에서는 refreshNow 가 즉시 한 번 조회한다', async () => {
  await stream.startStream({ onFatalError: vi.fn() });
  stream.refreshNow();

  expect(poller.pollOnce).toHaveBeenCalledTimes(1);
});

it('중단한 연결의 늦은 실패는 폴링을 다시 시작하지 않는다', async () => {
  const pending = stream.startStream({ onFatalError: vi.fn() });
  stream.stopStream();
  await pending;
  expect(poller.startPolling).not.toHaveBeenCalled();
  expect(state.getState().transport).toBe('none');
});

it('소켓이 연결 후 끊어져도 폴링을 시작하고 재입장 후 중단한다', async () => {
  const handlers = new Map();
  const fake = { connected: true, active: true, on: (name, fn) => handlers.set(name, fn), emit: vi.fn(), disconnect: vi.fn() };
  window.io = () => fake;
  const connecting = stream.startStream({ onFatalError: vi.fn() });
  handlers.get('connect')();
  handlers.get('chat:joined')({ roomId: 'room-1', status: 'bot', messages: [] });
  await connecting;
  handlers.get('disconnect')();
  expect(poller.startPolling).toHaveBeenCalledTimes(1);
  expect(state.getState().transport).toBe('polling');
  handlers.get('connect')();
  handlers.get('chat:joined')({ roomId: 'room-1', status: 'bot', messages: [] });
  expect(state.getState().transport).toBe('socket');
});
