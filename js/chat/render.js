import { SCROLL_THRESHOLD_PX, SERVICE_TYPES } from './config.js';
import { getLang, t } from './i18n.js';

/* ---------- 스크롤 유틸 ---------- */

/** 사용자가 맨 아래 근처를 보고 있는가? */
export function isNearBottom(scrollEl) {
  const distance = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
  return distance <= SCROLL_THRESHOLD_PX;
}

export function scrollToBottom(scrollEl, behavior = 'auto') {
  scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior });
}

/* ---------- 위젯 뼈대 만들기 ---------- */

/**
 * 정적 문구는 전부 data-i18n 속성으로 표시해두고 여기서 한 번에 채운다.
 * 페이지의 언어 전환 버튼이 <html lang> 을 바꿔도 이 함수만 다시 부르면
 * 위젯 전체가 같은 언어로 맞춰진다. (한국어/일본어가 섞이지 않게)
 */
export function applyStaticLabels(elements) {
  const root = elements.root;

  for (const el of root.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of root.querySelectorAll('[data-i18n-placeholder]')) {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  }
  for (const el of root.querySelectorAll('[data-i18n-aria]')) {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  }

  // 여는/닫는 라벨은 현재 열림 상태에 따라 달라진다.
  const isOpen = root.classList.contains('open');
  elements.toggle.setAttribute('aria-label', isOpen ? t('close.label') : t('open.label'));
}

function serviceOptionsHtml(preselected) {
  return ['', ...SERVICE_TYPES]
    .map((value) => {
      const key = value === '' ? 'field.service.placeholder' : `service.${value}`;
      const selected = value === preselected ? ' selected' : '';
      return `<option value="${value}" data-i18n="${key}"${selected}></option>`;
    })
    .join('');
}

function feedbackStarsHtml() {
  return [1, 2, 3, 4, 5]
    .map(
      (n) =>
        `<button type="button" class="fb-star" data-rating="${n}" role="radio" aria-checked="false" aria-label="${n}">★</button>`
    )
    .join('');
}

export function mountWidget({ defaultService = '', defaultLanguage = 'ko' } = {}) {
  const root = document.createElement('div');
  root.className = 'consult-chat';
  root.innerHTML = `
    <section class="consult-chat-panel" id="consult-chat-panel" aria-live="polite">
      <div class="consult-chat-head">
        <div>
          <span data-i18n="badge"></span>
          <h2 data-i18n="title"></h2>
        </div>
        <button type="button" class="consult-chat-close" data-i18n-aria="close.label">
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </div>

      <!-- 화면 A: 상담 시작 폼 -->
      <div class="consult-chat-stage" data-stage="form">
        <p class="consult-chat-intro" data-i18n="intro"></p>
        <form class="consult-chat-form" novalidate>
          <label>
            <span data-i18n="field.service"></span>
            <select name="serviceType">${serviceOptionsHtml(defaultService)}</select>
          </label>
          <label>
            <span data-i18n="field.name"></span>
            <input type="text" name="name" maxlength="50" autocomplete="name" data-i18n-placeholder="field.name.placeholder" />
          </label>
          <label>
            <span data-i18n="field.phone"></span>
            <input type="tel" name="phone" maxlength="30" autocomplete="tel" data-i18n-placeholder="field.phone.placeholder" />
          </label>
          <label>
            <span data-i18n="field.email"></span>
            <input type="email" name="email" autocomplete="email" data-i18n-placeholder="field.email.placeholder" />
          </label>
          <label>
            <span data-i18n="field.language"></span>
            <select name="preferredLanguage">
              <option value="ko" data-i18n="language.ko"${defaultLanguage === 'ko' ? ' selected' : ''}></option>
              <option value="ja" data-i18n="language.ja"${defaultLanguage === 'ja' ? ' selected' : ''}></option>
            </select>
          </label>
          <label>
            <span data-i18n="field.message"></span>
            <textarea maxlength="2000" name="message" rows="3" data-i18n-placeholder="field.message.placeholder"></textarea>
          </label>

          <div class="consult-chat-privacy">
            <input type="checkbox" name="privacyAgreed" id="scj-privacy" />
            <label for="scj-privacy">
              <span data-i18n="privacy.label"></span>
              <small data-i18n="privacy.detail"></small>
            </label>
          </div>

          <p class="consult-chat-status" role="status"></p>
          <button type="submit" class="consult-chat-submit">
            <i class="fas fa-paper-plane" aria-hidden="true"></i>
            <span data-role="submit-label" data-i18n="submit.start"></span>
          </button>
        </form>
      </div>

      <!-- 화면 B: 채팅 -->
      <div class="consult-chat-stage" data-stage="chat" hidden>
        <div class="consult-chat-statusbar" data-status="bot">
          <span class="dot"></span>
          <span data-role="status-label" data-i18n="status.bot"></span>
          <span class="reconnecting" data-role="reconnecting" data-i18n="error.network" hidden></span>
        </div>
        <p class="consult-chat-offline" data-role="offline-notice" hidden></p>

        <div class="consult-chat-threadwrap">
          <div class="consult-chat-thread" data-role="thread" tabindex="0"></div>
          <button type="button" class="consult-chat-newmsg" data-role="newmsg"
                  data-i18n="newMessages" hidden></button>
        </div>

        <div class="consult-chat-feedback" data-role="feedback" hidden>
          <p class="fb-title" data-i18n="feedback.title"></p>
          <p class="fb-hint" data-i18n="feedback.hint"></p>
          <div class="fb-stars" data-role="fb-stars" role="radiogroup" data-i18n-aria="feedback.title">
            ${feedbackStarsHtml()}
          </div>
          <textarea data-role="fb-comment" rows="2" data-i18n-placeholder="feedback.comment"></textarea>
          <div class="fb-actions">
            <button type="button" data-role="fb-skip" data-i18n="feedback.skip"></button>
            <button type="button" data-role="fb-submit" data-i18n="feedback.submit" disabled></button>
          </div>
          <p class="fb-done" data-role="fb-done" hidden></p>
        </div>

        <form class="consult-chat-composer">
          <textarea maxlength="2000" name="text" rows="1" data-i18n-placeholder="composer.placeholder"></textarea>
          <button type="submit" data-i18n="composer.send"></button>
        </form>

        <div class="consult-chat-actions">
          <button type="button" data-role="handoff" data-i18n="handoff"></button>
          <button type="button" data-role="new-chat" data-i18n="newChat"></button>
        </div>
      </div>
    </section>

    <button type="button" class="consult-chat-toggle"
            aria-expanded="false" aria-controls="consult-chat-panel">
      <i class="fas fa-comments" aria-hidden="true"></i>
      <span data-i18n="badge"></span>
    </button>
  `;

  document.body.appendChild(root);

  const elements = {
    root,
    toggle: root.querySelector('.consult-chat-toggle'),
    close: root.querySelector('.consult-chat-close'),
    formStage: root.querySelector('[data-stage="form"]'),
    chatStage: root.querySelector('[data-stage="chat"]'),
    startForm: root.querySelector('.consult-chat-form'),
    formStatus: root.querySelector('.consult-chat-status'),
    submitButton: root.querySelector('.consult-chat-submit'),
    submitLabel: root.querySelector('[data-role="submit-label"]'),
    statusbar: root.querySelector('.consult-chat-statusbar'),
    statusLabel: root.querySelector('[data-role="status-label"]'),
    reconnecting: root.querySelector('[data-role="reconnecting"]'),
    offlineNotice: root.querySelector('[data-role="offline-notice"]'),
    thread: root.querySelector('[data-role="thread"]'),
    newMsgButton: root.querySelector('[data-role="newmsg"]'),
    composer: root.querySelector('.consult-chat-composer'),
    composerInput: root.querySelector('.consult-chat-composer textarea'),
    composerButton: root.querySelector('.consult-chat-composer button'),
    handoffButton: root.querySelector('[data-role="handoff"]'),
    newChatButton: root.querySelector('[data-role="new-chat"]'),
    feedback: root.querySelector('[data-role="feedback"]'),
    fbStars: root.querySelector('[data-role="fb-stars"]'),
    fbComment: root.querySelector('[data-role="fb-comment"]'),
    fbSubmit: root.querySelector('[data-role="fb-submit"]'),
    fbSkip: root.querySelector('[data-role="fb-skip"]'),
    fbDone: root.querySelector('[data-role="fb-done"]')
  };

  applyStaticLabels(elements);

  return { root, elements };
}

/* ---------- 상태 → 화면 ---------- */

function messageNode(message) {
  const node = document.createElement('div');
  node.className = 'consult-chat-msg';
  node.dataset.sender = message.senderType;
  node.dataset.messageId = message.id;
  if (message.clientMessageId) node.dataset.clientMessageId = message.clientMessageId;

  // textContent 를 쓰므로 스크립트 삽입이 불가능하다.
  node.textContent = message.visibleText;

  if (message.senderType !== 'system') {
    const meta = document.createElement('span');
    meta.className = 'meta';
    // 브라우저 지역설정이 아니라 상담 언어를 따른다.
    // (일본어 화면에 '오전 10:15' 가 섞여 나오지 않게)
    meta.textContent = new Date(message.createdAt).toLocaleTimeString(
      getLang() === 'ja' ? 'ja-JP' : 'ko-KR',
      { hour: '2-digit', minute: '2-digit' }
    );
    node.appendChild(meta);
  }

  return node;
}

function pendingNode(pending) {
  const node = document.createElement('div');
  node.className = 'consult-chat-msg';
  node.dataset.sender = 'customer';
  node.dataset.clientMessageId = pending.clientMessageId;
  node.dataset.state = pending.status;
  node.textContent = pending.text;

  const meta = document.createElement('span');
  meta.className = 'meta';
  meta.textContent = pending.status === 'failed' ? t('sendFailed') : t('sending');
  node.appendChild(meta);

  if (pending.status === 'failed') {
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'retry-btn';
    retry.dataset.role = 'retry';
    retry.dataset.clientMessageId = pending.clientMessageId;
    retry.textContent = t('retry');
    node.appendChild(retry);
  }

  return node;
}

/**
 * 메시지 목록을 다시 그린다.
 *
 * 스크롤 규칙:
 * 1) 그리기 전에 "지금 맨 아래를 보고 있었나"를 기록한다.
 * 2) 다시 그린 뒤, 보고 있었으면 맨 아래로 따라간다.
 * 3) 아니면 스크롤 위치를 건드리지 않고 '새 메시지' 버튼만 띄운다.
 */
export function renderThread(elements, state) {
  const thread = elements.thread;
  const wasNearBottom = isNearBottom(thread);
  const previousCount = thread.children.length;
  const previousTop = thread.scrollTop;
  const anchor = [...thread.children].find(node => node.offsetTop + node.offsetHeight > thread.scrollTop);
  const anchorId = anchor?.dataset.messageId || anchor?.dataset.clientMessageId;
  const anchorOffset = anchor ? anchor.offsetTop - previousTop : 0;

  const fragment = document.createDocumentFragment();
  for (const message of state.messages) fragment.appendChild(messageNode(message));
  for (const pending of state.pending) fragment.appendChild(pendingNode(pending));

  thread.replaceChildren(fragment);

  const grew = thread.children.length > previousCount;

  if (wasNearBottom) {
    scrollToBottom(thread);
    elements.newMsgButton.hidden = true;
  } else {
    const restored = [...thread.children].find(node => (node.dataset.messageId || node.dataset.clientMessageId) === anchorId);
    thread.scrollTop = restored ? restored.offsetTop - anchorOffset : previousTop;
    if (grew) elements.newMsgButton.hidden = false;
  }
}

export function renderState(elements, state) {
  const inChat = state.phase === 'chat';
  elements.formStage.hidden = inChat;
  elements.chatStage.hidden = !inChat;

  // 시작 폼
  const starting = state.phase === 'starting';
  elements.submitButton.disabled = starting;
  elements.submitLabel.textContent = starting ? t('submit.starting') : t('submit.start');
  if (state.errorKey) {
    elements.formStatus.textContent = t(state.errorKey);
    elements.formStatus.classList.add('is-error');
  } else {
    elements.formStatus.textContent = '';
    elements.formStatus.classList.remove('is-error');
  }

  if (!inChat) return;

  // 채팅 화면
  const status = state.room?.status ?? 'bot';
  elements.statusbar.dataset.status = status;
  elements.reconnecting.hidden = state.connection !== 'reconnecting';

  // 상태 표시줄: 상담 상태 + (입력 중이면 그것만, 아니면 담당자 접속 여부)
  const parts = [t(`status.${status}`)];
  if (state.peerTyping) {
    parts.push(t('peer.typing'));
  } else if (state.presence.operatorOnline) {
    parts.push(t('presence.inRoom'));
  } else if (state.presence.anyOperatorOnline) {
    parts.push(t('presence.online'));
  }
  elements.statusLabel.textContent = parts.join(' · ');

  // 운영자를 기다리는 중인데 아무도 접속해 있지 않으면 안내 문구를 띄운다.
  const showOfflineNotice = (status === 'waiting' || status === 'bot') && !state.presence.anyOperatorOnline;
  elements.offlineNotice.hidden = !showOfflineNotice;
  if (showOfflineNotice) elements.offlineNotice.textContent = t('presence.offline');

  const closed = status === 'closed';
  elements.composerInput.disabled = closed;
  elements.composerButton.disabled = closed || elements.composerInput.value.trim() === '';
  elements.handoffButton.hidden = closed || status === 'active';

  // 상담이 종료되면 평가를 한 번 권한다.
  const showFeedback = closed && state.feedback !== 'hidden';
  elements.feedback.hidden = !showFeedback;
  // 평가 패널이 뜨면 메시지 목록의 최소 높이(200px)와 함께 패널 전체
  // max-height(min(70vh,560px))를 넘어서 스레드와 평가 패널이 겹쳐
  // 보인다 - 상담이 끝난 뒤라 스레드를 넓게 볼 필요도 적으므로 줄인다.
  elements.thread.classList.toggle('is-compact', showFeedback);
  if (showFeedback) {
    // 제출을 마치면(또는 이미 제출한 상태라면) 별점/의견 입력은 감추고
    // 감사 문구만 남긴다 - 그대로 두면 이미 보낸 평가를 또 보낼 수 있다.
    const isDone = state.feedback === 'done' || state.feedback === 'already';
    elements.fbStars.hidden = isDone;
    elements.fbComment.hidden = isDone;
    elements.fbSubmit.hidden = isDone;
    elements.fbSkip.hidden = isDone;
    elements.fbDone.hidden = !isDone;
    if (isDone) {
      elements.fbDone.textContent = state.feedback === 'already' ? t('feedback.already') : t('feedback.thanks');
    }
    elements.fbSubmit.disabled = state.feedback === 'sending' || !elements.fbStars.dataset.selected;
  }

  renderThread(elements, state);
}
