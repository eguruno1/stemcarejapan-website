import { sendMessage as sendMessageHttp } from './api.js';
import { pollOnce, startPolling, stopPolling } from './poller.js';
import {
  connectSocket,
  disconnectSocket,
  isSocketConnected,
  requestHandoffViaSocket,
  sendTyping as sendTypingSocket,
  sendViaSocket
} from './socket.js';
import { getSession, resolvePendingMessage, setTransport } from './state.js';

let mode = 'none'; // 'none' | 'socket' | 'polling'

/**
 * 실시간 연결을 시작한다.
 * 소켓을 먼저 시도하고, 실패하면 조용히 폴링으로 대체한다.
 * 고객은 어느 쪽으로 동작하는지 알 필요가 없다.
 */
export async function startStream({ onFatalError }) {
  stopStream();

  try {
    await connectSocket();
    mode = 'socket';
    setTransport('socket');
  } catch {
    console.info('[chat] 실시간 연결 실패 → 주기 조회로 전환합니다.');
    mode = 'polling';
    setTransport('polling');
    startPolling({ onError: onFatalError });
  }
}

export function stopStream() {
  disconnectSocket();
  stopPolling();
  mode = 'none';
  setTransport('none');
}

export function isRealtime() {
  return mode === 'socket' && isSocketConnected();
}

/**
 * 메시지를 보낸다.
 * 소켓이 살아 있으면 소켓으로, 아니면 HTTP 로 보낸다.
 * 두 경로 모두 clientMessageId 를 쓰므로 중복 저장되지 않는다.
 */
export async function sendMessage({ text, clientMessageId }) {
  if (isRealtime() && sendViaSocket({ text, clientMessageId })) {
    // 확정은 chat:message:ack 이벤트가 해준다.
    return;
  }

  const session = getSession();
  if (!session) throw new Error('세션이 없습니다.');

  const { message } = await sendMessageHttp(session.roomId, session.visitorToken, {
    text,
    clientMessageId
  });
  if (getSession() !== session) return;
  resolvePendingMessage(clientMessageId, message);

  // 폴링 모드에서는 답변이 와 있을 수 있으니 즉시 한 번 확인한다.
  if (mode === 'polling') void pollOnce();
}

export function sendTyping(isTyping) {
  if (isRealtime()) sendTypingSocket(isTyping);
}

/**
 * 위젯을 다시 열 때 부른다. 소켓 모드에서는 이미 실시간으로 최신 상태를
 * 받고 있으므로 할 일이 없다. 폴링 모드일 때만 한 번 즉시 조회한다.
 */
export function refreshNow() {
  if (mode === 'polling') void pollOnce();
}

export function requestHandoff() {
  return requestHandoffViaSocket();
}
