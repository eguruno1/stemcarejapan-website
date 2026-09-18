import { SCROLL_THRESHOLD_PX, SERVICE_TYPES } from './config.js';
import { t } from './i18n.js';

/* ---------- 스크롤 유틸 ---------- */

/** 사용자가 맨 아래 근처를 보고 있는가? */
export function isNearBottom(scrollEl) {
  const distance = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
  return distance <= SCROLL_THRESHOLD_PX;
}

export function scrollToBottom(scrollEl, behavior = 'auto') {
  scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior });
}

/* ---------- HTML 이스케이프 ---------- */

/**
 * 사전 문구는 우리가 쓴 것이지만, innerHTML 로 넣는 값은 예외 없이 이 함수를 거친다.
 * 고객이 입력한 문장은 innerHTML 을 쓰지 않고 textContent 로만 넣는다.
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/* ---------- 위젯 뼈대 만들기 ---------- */

function serviceOptions(preselected) {
  return ['', ...SERVICE_TYPES]
    .map((value) => {
      const label = value === '' ? t('field.service.placeholder') : t(`service.${value}`);
      const selected = value === preselected ? ' selected' : '';
      return `<option value="${value}"${selected}>${escapeHtml(label)}</option>`;
    })
    .join('');
}

export function mountWidget({ defaultService = '', defaultLanguage = 'ko' } = {}) {
  const root = document.createElement('div');
  root.className = 'consult-chat';
  root.innerHTML = `
    <section class="consult-chat-panel" id="consult-chat-panel" aria-live="polite">
      <div class="consult-chat-head">
        <div>
          <span>${escapeHtml(t('badge'))}</span>
          <h2>${escapeHtml(t('title'))}</h2>
        </div>
        <button type="button" class="consult-chat-close" aria-label="${escapeHtml(t('close.label'))}">
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </div>

      <!-- 화면 A: 상담 시작 폼 -->
      <div class="consult-chat-stage" data-stage="form">
        <p class="consult-chat-intro">${escapeHtml(t('intro'))}</p>
        <form class="consult-chat-form" novalidate>
          <label>
            <span>${escapeHtml(t('field.service'))}</span>
            <select name="serviceType">${serviceOptions(defaultService)}</select>
          </label>
          <label>
            <span>${escapeHtml(t('field.name'))}</span>
            <input type="text" name="name" autocomplete="name" placeholder="${escapeHtml(t('field.name.placeholder'))}" />
          </label>
          <label>
            <span>${escapeHtml(t('field.phone'))}</span>
            <input type="tel" name="phone" autocomplete="tel" placeholder="${escapeHtml(t('field.phone.placeholder'))}" />
          </label>
          <label>
            <span>${escapeHtml(t('field.email'))}</span>
            <input type="email" name="email" autocomplete="email" placeholder="${escapeHtml(t('field.email.placeholder'))}" />
          </label>
          <label>
            <span>${escapeHtml(t('field.language'))}</span>
            <select name="preferredLanguage">
              <option value="ko"${defaultLanguage === 'ko' ? ' selected' : ''}>${escapeHtml(t('language.ko'))}</option>
              <option value="ja"${defaultLanguage === 'ja' ? ' selected' : ''}>${escapeHtml(t('language.ja'))}</option>
            </select>
          </label>
          <label>
            <span>${escapeHtml(t('field.message'))}</span>
            <textarea name="message" rows="3" placeholder="${escapeHtml(t('field.message.placeholder'))}"></textarea>
          </label>

          <div class="consult-chat-privacy">
            <input type="checkbox" name="privacyAgreed" id="scj-privacy" />
            <label for="scj-privacy">
              ${escapeHtml(t('privacy.label'))}
              <small>${escapeHtml(t('privacy.detail'))}</small>
            </label>
          </div>

          <p class="consult-chat-status" role="status"></p>
          <button type="submit" class="consult-chat-submit">
            <i class="fas fa-paper-plane" aria-hidden="true"></i>
            <span data-role="submit-label">${escapeHtml(t('submit.start'))}</span>
          </button>
        </form>
      </div>

      <!-- 화면 B: 채팅 -->
      <div class="consult-chat-stage" data-stage="chat" hidden>
        <div class="consult-chat-statusbar" data-status="bot">
          <span class="dot"></span>
          <span data-role="status-label">${escapeHtml(t('status.bot'))}</span>
          <span class="reconnecting" data-role="reconnecting" hidden>${escapeHtml(t('error.network'))}</span>
        </div>

        <div class="consult-chat-threadwrap">
          <div class="consult-chat-thread" data-role="thread" tabindex="0"></div>
          <button type="button" class="consult-chat-newmsg" data-role="newmsg" hidden>
            ${escapeHtml(t('newMessages'))}
          </button>
        </div>

        <form class="consult-chat-composer">
          <textarea name="text" rows="1" placeholder="${escapeHtml(t('composer.placeholder'))}"></textarea>
          <button type="submit">${escapeHtml(t('composer.send'))}</button>
        </form>

        <div class="consult-chat-actions">
          <button type="button" data-role="handoff">${escapeHtml(t('handoff'))}</button>
          <button type="button" data-role="new-chat">${escapeHtml(t('newChat'))}</button>
        </div>
      </div>
    </section>

    <button type="button" class="consult-chat-toggle"
            aria-label="${escapeHtml(t('open.label'))}" aria-expanded="false" aria-controls="consult-chat-panel">
      <i class="fas fa-comments" aria-hidden="true"></i>
      <span>${escapeHtml(t('badge'))}</span>
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
    thread: root.querySelector('[data-role="thread"]'),
    newMsgButton: root.querySelector('[data-role="newmsg"]'),
    composer: root.querySelector('.consult-chat-composer'),
    composerInput: root.querySelector('.consult-chat-composer textarea'),
    composerButton: root.querySelector('.consult-chat-composer button'),
    handoffButton: root.querySelector('[data-role="handoff"]'),
    newChatButton: root.querySelector('[data-role="new-chat"]')
  };

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
    meta.textContent = new Date(message.createdAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
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

  const fragment = document.createDocumentFragment();
  for (const message of state.messages) fragment.appendChild(messageNode(message));
  for (const pending of state.pending) fragment.appendChild(pendingNode(pending));

  thread.replaceChildren(fragment);

  const grew = thread.children.length > previousCount;

  if (wasNearBottom) {
    scrollToBottom(thread);
    elements.newMsgButton.hidden = true;
  } else if (grew) {
    elements.newMsgButton.hidden = false;
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
  elements.statusLabel.textContent = t(`status.${status}`);
  elements.reconnecting.hidden = state.connection !== 'reconnecting';

  const closed = status === 'closed';
  elements.composerInput.disabled = closed;
  elements.composerButton.disabled = closed || elements.composerInput.value.trim() === '';
  elements.handoffButton.hidden = closed || status === 'active';

  renderThread(elements, state);
}
