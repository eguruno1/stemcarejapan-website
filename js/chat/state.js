import { STORAGE_KEY } from './config.js';

/**
 * 위젯의 모든 상태가 여기 모여 있다.
 * 화면(render.js)은 이 상태를 읽기만 하고, 바꾸는 건 widget.js 뿐이다.
 */
const state = {
  session: null,        // { roomId, visitorToken }
  room: null,           // { status, customerName, preferredLanguage, serviceType }
  messages: [],         // 서버가 확정한 메시지 (MessageDTO[])
  pending: [],          // 아직 서버 확인 전인 내 메시지
  phase: 'form',        // 'form' | 'starting' | 'chat'
  errorKey: null,       // i18n 키
  connection: 'idle',   // 'idle' | 'ok' | 'reconnecting'
  transport: 'none',    // 'none' | 'socket' | 'polling'
  peerTyping: false,
  presence: { operatorOnline: false, anyOperatorOnline: false }
};

const listeners = new Set();

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  for (const listener of listeners) listener(getState());
}

export function getState() {
  // 얕은 복사를 돌려줘서 바깥에서 실수로 원본을 고치지 못하게 한다.
  return {
    ...state,
    messages: [...state.messages],
    pending: [...state.pending],
    presence: { ...state.presence }
  };
}

/* ---------- 세션 (localStorage) ---------- */

export function loadSession() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.roomId !== 'string' || !parsed.roomId || typeof parsed?.visitorToken !== 'string' || !parsed.visitorToken) return null;
    state.session = parsed;
    return parsed;
  } catch {
    // 사파리 프라이빗 모드 등에서 localStorage 접근이 막힐 수 있다.
    return null;
  }
}

export function saveSession(session) {
  state.session = session;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // 저장 실패해도 이번 세션 동안은 메모리로 동작한다.
  }
  notify();
}

export function clearSession() {
  state.session = null;
  state.room = null;
  state.messages = [];
  state.pending = [];
  state.phase = 'form';
  state.errorKey = null;
  state.connection = 'idle';
  state.transport = 'none';
  state.peerTyping = false;
  state.presence = { operatorOnline: false, anyOperatorOnline: false };
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* 무시 */
  }
  notify();
}

export function getSession() {
  return state.session;
}

/* ---------- 화면 단계 ---------- */

export function setPhase(phase, errorKey = null) {
  state.phase = phase;
  state.errorKey = errorKey;
  notify();
}

export function setConnection(connection) {
  if (state.connection === connection) return;
  state.connection = connection;
  notify();
}

/* ---------- 상담방과 메시지 ---------- */

export function setRoom(room) {
  state.room = room;
  notify();
}

/** 소켓이 알려주는 상태만 갈아끼운다. room 의 나머지 필드는 그대로 둔다. */
export function setRoomStatus(status) {
  state.room = state.room ? { ...state.room, status } : { status };
  notify();
}

export function setTransport(transport) {
  if (state.transport === transport) return;
  state.transport = transport;
  notify();
}

export function setPeerTyping(isTyping) {
  if (state.peerTyping === isTyping) return;
  state.peerTyping = isTyping;
  notify();
}

export function setPresence(presence) {
  const next = {
    operatorOnline: Boolean(presence.operatorOnline),
    anyOperatorOnline: Boolean(presence.anyOperatorOnline)
  };
  if (
    state.presence.operatorOnline === next.operatorOnline &&
    state.presence.anyOperatorOnline === next.anyOperatorOnline
  ) {
    return;
  }
  state.presence = next;
  notify();
}

/**
 * 서버에서 받은 메시지 목록을 병합한다.
 * - 이미 있는 id 는 갱신 (번역이 늦게 붙는 경우)
 * - 같은 clientMessageId 의 pending 은 제거 (중복 표시 방지)
 */
export function upsertMessages(incoming) {
  const byId = new Map(state.messages.map((m) => [m.id, m]));
  for (const message of incoming) {
    byId.set(message.id, message);
  }
  state.messages = [...byId.values()].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  );

  const confirmedClientIds = new Set(
    incoming.filter((m) => m.senderType === 'customer').map((m) => m.clientMessageId).filter(Boolean)
  );
  state.pending = state.pending.filter((p) => !confirmedClientIds.has(p.clientMessageId));

  notify();
}

export function addPendingMessage(pendingMessage) {
  state.pending.push({ ...pendingMessage, status: 'sending' });
  notify();
}

export function resolvePendingMessage(clientMessageId, serverMessage) {
  state.pending = state.pending.filter((p) => p.clientMessageId !== clientMessageId);
  upsertMessages([serverMessage]);
}

export function failPendingMessage(clientMessageId) {
  const target = state.pending.find((p) => p.clientMessageId === clientMessageId);
  if (target) target.status = 'failed';
  notify();
}

/** 재시도 버튼이 원본 pending 을 되살릴 때 쓴다. getState() 사본이 아니라 원본을 준다. */
export function getPendingMessage(clientMessageId) {
  return state.pending.find((p) => p.clientMessageId === clientMessageId) ?? null;
}

export function retryPendingMessage(clientMessageId) {
  const target = state.pending.find((p) => p.clientMessageId === clientMessageId);
  if (!target || target.status !== 'failed') return null;
  target.status = 'sending';
  notify();
  return target;
}
