import { ChatApiError, sendMessage, startChat } from './api.js';
import { getLang, t } from './i18n.js';
import { pollOnce, startPolling, stopPolling } from './poller.js';
import { applyStaticLabels, mountWidget, renderState, scrollToBottom } from './render.js';
import {
  addPendingMessage,
  clearSession,
  failPendingMessage,
  getSession,
  getState,
  loadSession,
  resolvePendingMessage,
  retryPendingMessage,
  saveSession,
  setPhase,
  subscribe
} from './state.js';

/* ---------- 페이지 컨텍스트 ---------- */

function detectService() {
  const path = window.location.pathname;
  if (path.includes('/korea-travel')) return 'korea_travel';
  if (path.includes('/stemcell')) return 'stemcell';
  return '';
}

function newClientMessageId() {
  // crypto.randomUUID 는 https 또는 localhost 에서만 쓸 수 있다.
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `cid-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/* ---------- 오류를 i18n 키로 바꾸기 ---------- */

function errorKeyOf(error) {
  if (!(error instanceof ChatApiError)) return 'error.unknown';
  if (error.code === 'NETWORK_ERROR') return 'error.network';
  if (error.code === 'ROOM_CLOSED') return 'error.closed';
  if (error.status === 401 || error.status === 403 || error.status === 404) return 'error.expired';
  return 'error.unknown';
}

/** 저장된 세션이 서버에서 사라졌거나 만료됐을 때. */
function onSessionLost(error) {
  clearSession();
  setPhase('form', errorKeyOf(error));
}

/* ---------- 메인 ---------- */

function init() {
  const { elements } = mountWidget({
    defaultService: detectService(),
    defaultLanguage: getLang()
  });

  subscribe((state) => renderState(elements, state));

  bindPanelToggle(elements);
  bindStartForm(elements);
  bindComposer(elements);
  bindThreadActions(elements);
  bindLanguageChange(elements);

  restoreSession();

  // 첫 렌더
  renderState(elements, getState());
}

/* ---------- 페이지 언어 전환 따라가기 ---------- */

/**
 * korea-travel 페이지에는 JA/KO 전환 버튼이 있고, 누르면 <html lang> 이 바뀐다.
 * 위젯은 마운트할 때 한 번만 문구를 채우므로, 그대로 두면 상태 표시줄과 시각만
 * 새 언어로 바뀌고 나머지는 옛 언어로 남아 화면에 두 언어가 섞인다.
 */
function bindLanguageChange(elements) {
  let current = getLang();

  const observer = new MutationObserver(() => {
    const next = getLang();
    if (next === current) return;
    current = next;
    applyStaticLabels(elements);
    renderState(elements, getState());
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['lang', 'data-lang']
  });
}

/* ---------- 패널 열고 닫기 ---------- */

function bindPanelToggle(elements) {
  elements.toggle.addEventListener('click', () => {
    const isOpen = elements.root.classList.toggle('open');
    elements.toggle.setAttribute('aria-expanded', String(isOpen));
    elements.toggle.setAttribute('aria-label', isOpen ? t('close.label') : t('open.label'));
    if (isOpen && getState().phase === 'chat') {
      // 열 때는 항상 최신 메시지를 보여준다.
      scrollToBottom(elements.thread);
      elements.newMsgButton.hidden = true;
      void pollOnce();
    }
  });

  elements.close.addEventListener('click', () => {
    elements.root.classList.remove('open');
    elements.toggle.setAttribute('aria-expanded', 'false');
    elements.toggle.setAttribute('aria-label', t('open.label'));
  });
}

/* ---------- 세션 복원 ---------- */

function restoreSession() {
  const session = loadSession();
  if (!session) return;

  setPhase('chat');
  startPolling({ onError: onSessionLost });
}

/* ---------- 상담 시작 ---------- */

function bindStartForm(elements) {
  elements.startForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (getState().phase === 'starting') return;

    const data = new FormData(elements.startForm);
    const name = String(data.get('name') ?? '').trim();
    const phone = String(data.get('phone') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const serviceType = String(data.get('serviceType') ?? '').trim();
    const preferredLanguage = String(data.get('preferredLanguage') ?? 'ko');
    const message = String(data.get('message') ?? '').trim();
    const privacyAgreed = data.get('privacyAgreed') !== null;

    // 화면에서 먼저 막는다. 동의 전에는 API 를 아예 호출하지 않는다. (서버도 다시 검사한다)
    if (!serviceType) return setPhase('form', 'error.service');
    if (!name || !phone) return setPhase('form', 'error.required');
    if (!privacyAgreed) return setPhase('form', 'error.privacy');

    setPhase('starting');

    try {
      const result = await startChat({
        name,
        phone,
        email: email || undefined,
        preferredLanguage,
        serviceType,
        sourcePage: window.location.pathname,
        message: message || undefined,
        privacyAgreed: true
      });

      saveSession({ roomId: result.roomId, visitorToken: result.visitorToken });
      setPhase('chat');
      startPolling({ onError: onSessionLost });
    } catch (error) {
      setPhase('form', errorKeyOf(error));
    }
  });
}

/* ---------- 메시지 전송 (낙관적 UI) ---------- */

async function submitMessage(text, clientMessageId) {
  const session = getSession();
  if (!session) return;

  try {
    const { message } = await sendMessage(session.roomId, session.visitorToken, {
      text,
      clientMessageId
    });
    resolvePendingMessage(clientMessageId, message);
    // 운영자 답변이 이미 와 있을 수 있으니 바로 한 번 더 확인한다.
    void pollOnce();
  } catch {
    failPendingMessage(clientMessageId);
  }
}

function bindComposer(elements) {
  const input = elements.composerInput;

  input.addEventListener('input', () => {
    // 내용에 맞춰 높이를 늘린다. (최대 높이는 CSS 가 제한한다)
    input.style.height = 'auto';
    input.style.height = `${input.scrollHeight}px`;
    elements.composerButton.disabled = input.value.trim() === '';
  });

  // Enter = 전송, Shift+Enter = 줄바꿈
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      elements.composer.requestSubmit();
    }
  });

  elements.composer.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    const clientMessageId = newClientMessageId();
    addPendingMessage({ clientMessageId, text, createdAt: new Date().toISOString() });

    input.value = '';
    input.style.height = 'auto';
    elements.composerButton.disabled = true;
    // 내가 보낸 메시지는 위로 올려보던 중이었더라도 따라 내려간다.
    scrollToBottom(elements.thread);
    elements.newMsgButton.hidden = true;

    void submitMessage(text, clientMessageId);
  });
}

/* ---------- 스레드 내 버튼들 ---------- */

function bindThreadActions(elements) {
  // 새 메시지 버튼
  elements.newMsgButton.addEventListener('click', () => {
    scrollToBottom(elements.thread, 'smooth');
    elements.newMsgButton.hidden = true;
  });

  // 사용자가 직접 맨 아래로 내리면 버튼을 감춘다.
  elements.thread.addEventListener('scroll', () => {
    const distance =
      elements.thread.scrollHeight - elements.thread.scrollTop - elements.thread.clientHeight;
    if (distance <= 100) elements.newMsgButton.hidden = true;
  });

  // 전송 실패 재시도 (이벤트 위임: 말풍선은 계속 새로 그려지므로 개별 등록하면 안 된다)
  elements.thread.addEventListener('click', (event) => {
    const button = event.target.closest('[data-role="retry"]');
    if (!button) return;

    const clientMessageId = button.dataset.clientMessageId;
    const pending = retryPendingMessage(clientMessageId);
    if (!pending) return;

    void submitMessage(pending.text, clientMessageId);
  });

  // 담당자 연결 요청
  elements.handoffButton.addEventListener('click', () => {
    if (!getSession()) return;

    const clientMessageId = newClientMessageId();
    const text = t('handoff.message');
    addPendingMessage({ clientMessageId, text, createdAt: new Date().toISOString() });
    scrollToBottom(elements.thread);
    void submitMessage(text, clientMessageId);
  });

  // 새 상담 시작
  elements.newChatButton.addEventListener('click', () => {
    stopPolling();
    clearSession();
  });
}

/* ---------- 실행 ---------- */

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
