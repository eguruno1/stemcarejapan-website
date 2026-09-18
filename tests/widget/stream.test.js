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
