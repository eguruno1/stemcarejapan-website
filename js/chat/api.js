import { API_BASE } from './config.js';

/**
 * 서버가 돌려준 오류를 코드와 함께 담는다.
 * 화면은 error.code / error.status 만 보고 문구를 고르면 된다.
 */
export class ChatApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ChatApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * 모든 요청이 지나가는 단 하나의 통로.
 * 여기서만 오류 형식을 해석하므로, 서버 오류 형식이 바뀌어도 이 함수만 고치면 된다.
 */
async function request(path, { method = 'GET', body, visitorToken } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (visitorToken) headers['X-Visitor-Token'] = visitorToken;

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    // fetch 자체가 실패 = 인터넷 끊김, CORS, 서버 다운
    throw new ChatApiError(0, 'NETWORK_ERROR', 'network unreachable');
  }

  if (response.status === 204) return null;

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const code = payload?.error?.code ?? 'UNKNOWN_ERROR';
    const message = payload?.error?.message ?? `HTTP ${response.status}`;
    throw new ChatApiError(response.status, code, message);
  }

  if (!payload || typeof payload !== 'object') {
    throw new ChatApiError(502, 'INVALID_RESPONSE', 'invalid server response');
  }
  return payload;
}

export function startChat(payload) {
  return request('/api/public/chat/start', { method: 'POST', body: payload });
}

export function fetchRoom(roomId, visitorToken) {
  return request(`/api/public/chat/${encodeURIComponent(roomId)}`, { visitorToken });
}

export function sendMessage(roomId, visitorToken, { text, clientMessageId }) {
  return request(`/api/public/chat/${encodeURIComponent(roomId)}/messages`, {
    method: 'POST',
    visitorToken,
    body: { text, clientMessageId }
  });
}

export function requestHandoff(roomId, visitorToken) {
  return request(`/api/public/chat/${encodeURIComponent(roomId)}/handoff`, { method: 'POST', visitorToken });
}
