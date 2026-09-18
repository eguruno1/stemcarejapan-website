import { ChatApiError, startChat, submitFeedback as submitFeedbackApi } from './api.js';
import { getLang, t } from './i18n.js';
import {
  refreshNow,
  requestHandoff as requestHandoffStream,
  sendMessage as sendMessageStream,
  sendTyping,
  startStream,
  stopStream
} from './stream.js';
import { applyStaticLabels, mountWidget, renderState, scrollToBottom } from './render.js';
import {
  addPendingMessage,
  clearSession,
  failPendingMessage,
  getSession,
  getState,
  loadSession,
  retryPendingMessage,
  saveSession,
  setConnection,
  setFeedbackPhase,
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
  stopStream();
  clearSession();
  setPhase('form', errorKeyOf(error));
}

/* ---------- 메인 ---------- */

function init() {
  const { elements } = mountWidget({
    defaultService: detectService(),
    defaultLanguage: getLang()
  });

  // 상담 상태가 closed 로 바뀌는 순간에만 평가를 권한다. previousStatus 를
  // null 로 시작해두면, 이미 종료된 상담을 새로고침으로 다시 열었을 때
  // (첫 notify) 는 조건에 안 걸려 평가창이 매번 다시 뜨지 않는다.
  let previousStatus = null;
  subscribe((state) => {
    const status = state.room?.status ?? null;

    if (status === 'closed' && previousStatus !== null && previousStatus !== 'closed') {
      if (state.feedback === 'hidden') setFeedbackPhase('prompt');
    }
    previousStatus = status;

    // setFeedbackPhase 를 부르면 notify() 가 이 콜백을 곧바로(동기) 다시
    // 부른다 - 그 안쪽 호출이 이미 최신 state 로 한 번 그린 뒤 되돌아온다.
    // 여기서 매개변수 state(호출 당시 스냅샷)로 다시 그리면 feedback 값이
    // 'hidden' 이던 옛 스냅샷이 방금 그린 화면을 덮어써 평가창이 계속
    // 숨어 있게 된다. 항상 최신 상태를 다시 읽어서 그린다.
    renderState(elements, getState());
  });

  bindPanelToggle(elements);
  bindStartForm(elements);
  bindComposer(elements);
  bindThreadActions(elements);
  bindFeedback(elements);
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
      refreshNow();
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
  void startStream({ onFatalError: onSessionLost });
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
    if (!name || name.length > 50) return setPhase('form', 'error.name');
    if (phone.length < 5 || phone.length > 30) return setPhase('form', 'error.phone');
    if (email && !elements.startForm.elements.email.validity.valid) return setPhase('form', 'error.email');
    if (message.length > 2000) return setPhase('form', 'error.length');
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
      void startStream({ onFatalError: onSessionLost });
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
    // stream.sendMessage 는 소켓이 살아 있으면 소켓으로, 아니면 HTTP 로 보낸다.
    // 소켓 성공은 chat:message:ack 가, 소켓 실패는 chat:error 의 clientMessageId 매칭이
    // 각자 pending 말풍선을 정리한다 — 이 함수는 HTTP 경로의 오류만 처리하면 된다.
    await sendMessageStream({ text, clientMessageId });
  } catch (error) {
    if (getSession() !== session) return;
    if (error instanceof ChatApiError && [401, 403, 404].includes(error.status)) {
      onSessionLost(error);
      return;
    }
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
    sendTyping(input.value.trim().length > 0);
  });

  // Enter = 전송, Shift+Enter = 줄바꿈
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
      event.preventDefault();
      elements.composer.requestSubmit();
    }
  });

  elements.composer.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || text.length > 2000 || !getSession() || getState().room?.status === 'closed') return;

    const clientMessageId = newClientMessageId();
    addPendingMessage({ clientMessageId, text, createdAt: new Date().toISOString() });

    input.value = '';
    input.style.height = 'auto';
    elements.composerButton.disabled = true;
    sendTyping(false);

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
  elements.handoffButton.addEventListener('click', async () => {
    const session = getSession();
    if (!session || getState().room?.status === 'closed') return;
    elements.handoffButton.disabled = true;
    try { await requestHandoffStream(); }
    catch (error) {
      if (getSession() !== session) return;
      if ([401, 403, 404].includes(error.status)) onSessionLost();
      else if (error.code === 'ROOM_CLOSED') refreshNow();
      else setConnection('reconnecting');
    } finally { elements.handoffButton.disabled = getState().room?.status === 'closed'; }
  });

  // 새 상담 시작
  elements.newChatButton.addEventListener('click', () => {
    stopStream();
    clearSession();
    elements.composerInput.value = '';
    elements.composerInput.style.height = 'auto';
  });
}

/* ---------- 상담 종료 후 평가 ---------- */

function bindFeedback(elements) {
  // 별점 선택 (이벤트 위임)
  elements.fbStars.addEventListener('click', (event) => {
    const button = event.target.closest('.fb-star');
    if (!button) return;

    const rating = Number(button.dataset.rating);
    elements.fbStars.dataset.selected = String(rating);

    for (const star of elements.fbStars.querySelectorAll('.fb-star')) {
      const isOn = Number(star.dataset.rating) <= rating;
      star.classList.toggle('is-on', isOn);
      star.setAttribute('aria-checked', String(Number(star.dataset.rating) === rating));
    }

    elements.fbSubmit.disabled = false;
  });

  elements.fbSkip.addEventListener('click', () => setFeedbackPhase('hidden'));

  elements.fbSubmit.addEventListener('click', async () => {
    const session = getSession();
    const rating = Number(elements.fbStars.dataset.selected);
    if (!session || !rating) return;

    setFeedbackPhase('sending');

    try {
      await submitFeedbackApi(session.roomId, session.visitorToken, {
        rating,
        comment: elements.fbComment.value.trim()
      });
      setFeedbackPhase('done');
    } catch (error) {
      // 이미 평가했다면 감사 문구를 보여주고 끝낸다. 오류로 취급하지 않는다.
      if (error instanceof ChatApiError && error.code === 'ALREADY_SUBMITTED') {
        setFeedbackPhase('already');
        return;
      }
      setFeedbackPhase('prompt');
    }
  });
}

/* ---------- 실행 ---------- */

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
