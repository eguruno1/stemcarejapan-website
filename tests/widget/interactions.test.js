import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ startChat: vi.fn(), sendMessage: vi.fn(), submitFeedback: vi.fn() }));
vi.mock('../../js/chat/api.js', () => ({ ...api, ChatApiError: class extends Error {} }));
vi.mock('../../js/chat/poller.js', () => ({ pollOnce: vi.fn(), startPolling: vi.fn(), stopPolling: vi.fn() }));
let state;
beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks(); document.body.innerHTML = ''; localStorage.clear();
  document.documentElement.lang = 'ko';
  Element.prototype.scrollTo = function ({ top }) { this.scrollTop = top; };
  state = await import('../../js/chat/state.js');
  await import('../../js/chat/widget.js');
});
afterEach(() => { document.body.innerHTML = ''; });
it('동의 전 API 호출을 막고 이름·연락처 오류를 구분한다', () => {
  const form = document.querySelector('.consult-chat-form');
  form.elements.serviceType.value = 'stemcell';
  form.requestSubmit(); expect(document.querySelector('.consult-chat-status').textContent).toContain('성함');
  form.elements.name.value = '고객'; form.requestSubmit(); expect(document.querySelector('.consult-chat-status').textContent).toContain('연락처');
  form.elements.phone.value = '12345'; form.requestSubmit(); expect(document.querySelector('.consult-chat-status').textContent).toContain('동의');
  expect(api.startChat).not.toHaveBeenCalled();
});
it('IME 확정 Enter와 종료된 방은 전송하지 않는다', () => {
  state.saveSession({ roomId: 'a', visitorToken: 'token' }); state.setPhase('chat');
  state.setRoom({ status: 'active' });
  const input = document.querySelector('.consult-chat-composer textarea'); input.value = '문의';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }));
  expect(api.sendMessage).not.toHaveBeenCalled();
  state.setRoom({ status: 'closed' }); document.querySelector('.consult-chat-composer').requestSubmit();
  expect(api.sendMessage).not.toHaveBeenCalled();
});
it('새 상담을 시작한 뒤 이전 전송 응답이 도착해도 섞이지 않는다', async () => {
  let finish; api.sendMessage.mockImplementation(() => new Promise(r => { finish = r; }));
  state.saveSession({ roomId: 'a', visitorToken: 'token' }); state.setPhase('chat'); state.setRoom({ status: 'active' });
  const input = document.querySelector('.consult-chat-composer textarea'); input.value = '문의';
  document.querySelector('.consult-chat-composer').requestSubmit();
  document.querySelector('[data-role="new-chat"]').click();
  finish({ message: { id: 'old', senderType: 'customer', createdAt: new Date().toISOString(), visibleText: '문의' } });
  await Promise.resolve(); await Promise.resolve();
  expect(state.getState().messages).toEqual([]);
});

it('이전 상담 평가 응답이 새 상담의 평가 상태를 덮어쓰지 않는다', async () => {
  let finish; api.submitFeedback.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  state.saveSession({ roomId: 'a', visitorToken: 'token' }); state.setPhase('chat');
  state.setRoom({ status: 'active' }); state.setRoom({ status: 'closed' });
  document.querySelector('.fb-star[data-rating="5"]').click();
  document.querySelector('[data-role="fb-comment"]').value = '이전 고객 의견';
  document.querySelector('[data-role="fb-submit"]').click();
  expect(state.getState().feedback).toBe('sending');
  document.querySelector('[data-role="new-chat"]').click();
  state.saveSession({ roomId: 'b', visitorToken: 'new-token' });
  finish({ feedback: {} }); await Promise.resolve(); await Promise.resolve();
  expect(state.getState().feedback).toBe('hidden');
  expect(document.querySelector('[data-role="fb-comment"]').value).toBe('');
  expect(document.querySelector('[data-role="fb-stars"]').dataset.selected).toBeUndefined();
});
