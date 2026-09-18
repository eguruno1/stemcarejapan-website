import { API_BASE } from './config.js';
import {
  failPendingMessage,
  getSession,
  resolvePendingMessage,
  setConnection,
  setPeerTyping,
  setPresence,
  setRoomStatus,
  setTransport,
  upsertMessages
} from './state.js';

let socket = null;
let typingTimer = null;

/** 소켓 연결이 이 시간 안에 안 되면 폴링으로 돌아간다. */
const CONNECT_TIMEOUT_MS = 5000;

/**
 * Socket.IO 로 상담방에 연결한다.
 * 실패하면 reject 하므로, 호출한 쪽(stream.js)에서 폴링으로 대체한다.
 */
export function connectSocket() {
  const session = getSession();
  if (!session) return Promise.reject(new Error('세션이 없습니다.'));

  // CDN 스크립트가 로드되지 않은 경우 (차단, 오프라인 등)
  if (typeof window.io !== 'function') {
    return Promise.reject(new Error('socket.io 를 불러오지 못했습니다.'));
  }

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      socket?.disconnect();
      socket = null;
      reject(new Error('소켓 연결 시간 초과'));
    }, CONNECT_TIMEOUT_MS);

    const nextSocket = window.io(API_BASE, {
      auth: { roomId: session.roomId, visitorToken: session.visitorToken },
      // websocket 이 막힌 환경을 위해 polling transport 도 허용한다.
      transports: ['websocket', 'polling'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000
    });
    socket = nextSocket;

    nextSocket.on('connect', () => {
      window.clearTimeout(timer);
      setConnection('ok');
      setTransport('socket');
      nextSocket.emit('chat:join', { roomId: session.roomId });
    });

    nextSocket.on('connect_error', (err) => {
      window.clearTimeout(timer);
      // 이미 한 번 연결된 뒤의 오류는 자동 재연결에 맡긴다.
      if (nextSocket.active) {
        setConnection('reconnecting');
        return;
      }
      nextSocket.disconnect();
      if (socket === nextSocket) socket = null;
      reject(err);
    });

    nextSocket.on('chat:joined', (payload) => {
      setRoomStatus(payload.status);
      upsertMessages(payload.messages);
      resolve(nextSocket);
    });

    nextSocket.on('chat:message', (payload) => {
      upsertMessages([payload.message]);
    });

    nextSocket.on('chat:message:ack', (payload) => {
      resolvePendingMessage(payload.clientMessageId, payload.message);
    });

    nextSocket.on('chat:status', (payload) => {
      setRoomStatus(payload.status);
    });

    nextSocket.on('chat:presence', (payload) => {
      setPresence(payload);
    });

    nextSocket.on('chat:typing', (payload) => {
      // 운영자가 입력 중일 때만 고객에게 보여준다.
      if (payload.from === 'operator') setPeerTyping(payload.isTyping);
    });

    nextSocket.on('chat:error', (payload) => {
      console.warn('[chat] 서버 오류:', payload.code);
      // 서버가 어떤 pending 말풍선을 거부했는지 알려주면, ack 없이도 실패로 표시한다.
      // (없으면 그 말풍선이 '전송 중' 에서 영영 안 넘어간다)
      if (payload.clientMessageId) failPendingMessage(payload.clientMessageId);
    });

    nextSocket.on('disconnect', (reason) => {
      setConnection('reconnecting');
      setPeerTyping(false);
      // 서버가 의도적으로 끊은 경우는 자동 재연결하지 않는다.
      if (reason === 'io server disconnect') nextSocket.connect();
    });

    nextSocket.io.on('reconnect', () => {
      setConnection('ok');
      // 끊긴 동안 놓친 메시지를 받기 위해 다시 join 한다.
      nextSocket.emit('chat:join', { roomId: session.roomId });
    });
  });
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  setTransport('none');
  setPeerTyping(false);
}

export function isSocketConnected() {
  return Boolean(socket?.connected);
}

export function sendViaSocket({ text, clientMessageId }) {
  const session = getSession();
  if (!session || !socket?.connected) return false;

  socket.emit('chat:message', { roomId: session.roomId, text, clientMessageId });
  return true;
}

/** 입력 중 신호. 너무 자주 보내지 않도록 1.5초 뒤 자동으로 끈다. */
export function sendTyping(isTyping) {
  const session = getSession();
  if (!session || !socket?.connected) return;

  socket.emit('chat:typing', { roomId: session.roomId, isTyping });

  window.clearTimeout(typingTimer);
  if (isTyping) {
    typingTimer = window.setTimeout(() => {
      socket?.emit('chat:typing', { roomId: session.roomId, isTyping: false });
    }, 1500);
  }
}

export function requestHandoffViaSocket() {
  const session = getSession();
  if (!session || !socket?.connected) return false;

  socket.emit('chat:handoff-request', { roomId: session.roomId, reason: 'customer_requested' });
  return true;
}
