import { API_BASE } from './config.js';
import {
  failPendingMessage, getSession, resolvePendingMessage, setConnection,
  setPeerTyping, setPresence, setRoomStatus, setTransport, upsertMessages
} from './state.js';

let socket = null;
let dispose = null;
let ready = false;
const CONNECT_TIMEOUT_MS = 5000;

/** 연결과 입장까지 확인한 뒤 실시간 전송을 허용한다. 모든 콜백은 세션에 귀속된다. */
export function connectSocket({ onReady = () => {}, onUnavailable = () => {} } = {}) {
  disconnectSocket();
  const session = getSession();
  if (!session || typeof window.io !== 'function') return Promise.reject(new Error('소켓 연결 불가'));
  return new Promise((resolve, reject) => {
    const next = window.io(API_BASE, {
      auth: { roomId: session.roomId, visitorToken: session.visitorToken },
      transports: ['polling', 'websocket'],
      reconnectionAttempts: Infinity, reconnectionDelay: 1000, reconnectionDelayMax: 8000
    });
    socket = next;
    const current = () => socket === next && getSession() === session;
    let statusReceived = false;
    let typingTimer;
    let sendTypingTimer;
    const pending = new Map();
    const forget = id => { window.clearTimeout(pending.get(id)); pending.delete(id); };
    const failOutstanding = () => {
      for (const id of pending.keys()) { failPendingMessage(id); window.clearTimeout(pending.get(id)); }
      pending.clear();
    };
    const unavailable = () => {
      ready = false;
      setConnection('reconnecting');
      setPeerTyping(false);
      setPresence({});
      failOutstanding();
      onUnavailable();
    };
    // connect_error(active=true)도 이 타이머를 취소하지 않는다.
    let timer = window.setTimeout(() => {
      if (!current()) return;
      disconnectSocket();
      reject(new Error('소켓 입장 시간 초과'));
    }, CONNECT_TIMEOUT_MS);
    dispose = () => {
      window.clearTimeout(timer);
      window.clearTimeout(typingTimer);
      window.clearTimeout(sendTypingTimer);
      failOutstanding();
      reject(new Error('소켓 연결 취소'));
    };
    next.on('connect', () => {
      if (!current()) return;
      ready = false;
      statusReceived = false;
      next.emit('chat:join', { roomId: session.roomId });
      // 재연결 후에도 입장 응답을 못 받으면 폴링을 유지한다.
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { if (current()) unavailable(); }, CONNECT_TIMEOUT_MS);
    });
    next.on('connect_error', err => {
      if (!current()) return;
      unavailable();
      if (!next.active) { disconnectSocket(); reject(err); }
    });
    next.on('chat:joined', payload => {
      if (!current() || payload.roomId !== session.roomId) return;
      window.clearTimeout(timer);
      if (!statusReceived) setRoomStatus(payload.status);
      upsertMessages(payload.messages);
      ready = true;
      setConnection('ok'); setTransport('socket');
      onReady();
      resolve(next);
    });
    next.on('chat:message', payload => {
      if (!current() || payload.message.chatRoomId !== session.roomId) return;
      if (payload.message.senderType === 'customer') forget(payload.message.clientMessageId);
      upsertMessages([payload.message]);
    });
    next.on('chat:message:update', payload => {
      // 번역문이 늦게 붙는 경우 등. upsertMessages 는 같은 id 면 내용을 덮어쓴다.
      if (!current() || payload.message.chatRoomId !== session.roomId) return;
      upsertMessages([payload.message]);
    });
    next.on('chat:message:ack', payload => {
      if (!current() || payload.message.chatRoomId !== session.roomId) return;
      forget(payload.clientMessageId);
      resolvePendingMessage(payload.clientMessageId, payload.message);
    });
    next.on('chat:status', payload => {
      if (!current() || payload.roomId !== session.roomId) return;
      statusReceived = true;
      setRoomStatus(payload.status);
    });
    next.on('chat:presence', payload => {
      if (current() && payload.roomId === session.roomId) setPresence(payload);
    });
    next.on('chat:typing', payload => {
      if (!current() || payload.roomId !== session.roomId || payload.from !== 'operator') return;
      window.clearTimeout(typingTimer);
      setPeerTyping(payload.isTyping);
      if (payload.isTyping) typingTimer = window.setTimeout(() => { if (current()) setPeerTyping(false); }, 3000);
    });
    next.on('chat:error', payload => {
      if (!current()) return;
      if (payload.clientMessageId) { forget(payload.clientMessageId); failPendingMessage(payload.clientMessageId); }
      if (payload.code === 'ROOM_CLOSED') setRoomStatus('closed');
      if (!ready || ['UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND'].includes(payload.code)) {
        unavailable();
        disconnectSocket();
        reject(new Error(payload.code));
      }
    });
    next.on('disconnect', () => { if (current()) unavailable(); });
    next.trackMessage = id => {
      forget(id);
      pending.set(id, window.setTimeout(() => { if (current()) failPendingMessage(id); forget(id); }, 8000));
    };
    next.sendTyping = isTyping => {
      next.emit('chat:typing', { roomId: session.roomId, isTyping });
      window.clearTimeout(sendTypingTimer);
      if (isTyping) sendTypingTimer = window.setTimeout(() => {
        if (current() && ready) next.emit('chat:typing', { roomId: session.roomId, isTyping: false });
      }, 1500);
    };
  });
}

export function disconnectSocket() {
  const previous = socket;
  socket = null; ready = false;
  dispose?.(); dispose = null;
  previous?.disconnect();
  setTransport('none'); setPeerTyping(false); setPresence({});
}
export function isSocketConnected() { return Boolean(ready && socket?.connected); }
export function sendViaSocket({ text, clientMessageId }) {
  const session = getSession();
  if (!session || !isSocketConnected()) return false;
  socket.trackMessage(clientMessageId);
  socket.emit('chat:message', { roomId: session.roomId, text, clientMessageId });
  return true;
}
export function sendTyping(isTyping) { if (isSocketConnected()) socket.sendTyping(isTyping); }
