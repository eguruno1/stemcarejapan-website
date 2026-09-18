import { POLL_INTERVAL_MS } from './config.js';
import { ChatApiError, fetchRoom } from './api.js';
import { getSession, setConnection, setRoom, upsertMessages } from './state.js';

let timerId = null;
let inFlight = null;
let generation = 0;
let handlers = { onError: () => {} };

/**
 * 서버에서 상담방 상태와 메시지를 한 번 가져온다.
 *
 * Phase 4 에서 Socket.IO 로 교체할 때, 이 파일만 socket.js 로 갈아끼우면 된다.
 * widget.js 는 startPolling/stopPolling/pollOnce 이름만 알고 있으므로 영향이 적다.
 */
export async function pollOnce() {
  const session = getSession();
  if (!session || inFlight) return;

  const requestId = {};
  const version = generation;
  inFlight = requestId;
  const isCurrent = () => version === generation && getSession() === session;
  try {
    const room = await fetchRoom(session.roomId, session.visitorToken);
    if (!isCurrent()) return;
    setRoom({
      status: room.status,
      customerName: room.customerName,
      preferredLanguage: room.preferredLanguage,
      serviceType: room.serviceType
    });
    upsertMessages(room.messages);
    setConnection('ok');
  } catch (error) {
    if (!isCurrent()) return;
    if (error instanceof ChatApiError && [401, 403, 404].includes(error.status)) {
      const onError = handlers.onError;
      stopPolling();
      onError(error);
    } else {
      // 서버 장애·잘못된 응답도 세션을 지우지 않고 다음 주기에 재시도한다.
      setConnection('reconnecting');
    }
  } finally {
    if (inFlight === requestId) inFlight = null;
  }
}

export function startPolling({ onError } = {}) {
  stopPolling();
  handlers = { onError: onError ?? (() => {}) };

  void pollOnce();
  timerId = window.setInterval(() => {
    // 브라우저 탭이 백그라운드면 서버를 괴롭히지 않는다.
    if (document.visibilityState === 'hidden') return;
    void pollOnce();
  }, POLL_INTERVAL_MS);

  // 탭으로 돌아오면 즉시 한 번 갱신한다.
  document.addEventListener('visibilitychange', onVisibilityChange);
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') void pollOnce();
}

export function stopPolling() {
  generation += 1;
  inFlight = null;
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
  document.removeEventListener('visibilitychange', onVisibilityChange);
}
