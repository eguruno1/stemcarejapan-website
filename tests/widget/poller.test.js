import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ChatApiError, fetchRoom } from '../../js/chat/api.js';
import { clearSession, getState, saveSession } from '../../js/chat/state.js';
import { pollOnce, startPolling, stopPolling } from '../../js/chat/poller.js';
vi.mock('../../js/chat/api.js', () => ({
  fetchRoom: vi.fn(),
  ChatApiError: class extends Error { constructor(status, code) { super(code); this.status = status; this.code = code; } }
}));
const room = name => ({ status: 'active', customerName: name, preferredLanguage: 'ja', serviceType: 'korea_travel', messages: [] });
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); clearSession(); });
afterEach(() => { stopPolling(); vi.useRealTimers(); });
it('500 오류 후 세션을 유지하고 다음 폴링에서 복구한다', async () => {
  saveSession({ roomId: 'one', visitorToken: 'token' });
  fetchRoom.mockRejectedValueOnce(new ChatApiError(500, 'INTERNAL_ERROR')).mockResolvedValue(room('고객'));
  const onError = vi.fn(); startPolling({ onError });
  await vi.advanceTimersByTimeAsync(0);
  expect(onError).not.toHaveBeenCalled();
  expect(getState().connection).toBe('reconnecting');
  await vi.advanceTimersByTimeAsync(3000);
  expect(getState().room.customerName).toBe('고객');
});
it('세션 교체 뒤 도착한 이전 방 응답은 무시한다', async () => {
  let finish;
  fetchRoom.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  saveSession({ roomId: 'old', visitorToken: 'old-token' });
  const pending = pollOnce();
  stopPolling(); clearSession(); saveSession({ roomId: 'new', visitorToken: 'new-token' });
  finish(room('이전 고객')); await pending;
  expect(getState().room).toBeNull();
});
it('인증 실패는 폴링을 멈추고 세션 만료 콜백을 부른다', async () => {
  saveSession({ roomId: 'one', visitorToken: 'token' });
  fetchRoom.mockRejectedValue(new ChatApiError(403, 'FORBIDDEN'));
  const onError = vi.fn(); startPolling({ onError });
  await vi.advanceTimersByTimeAsync(0);
  expect(onError).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(6000);
  expect(fetchRoom).toHaveBeenCalledTimes(1);
});
