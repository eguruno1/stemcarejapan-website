/* 채팅 위젯 설정값. 여기 외에는 하드코딩된 주소가 없어야 한다. */

/**
 * API 서버 주소.
 * 로컬 개발이면 localhost:4000, 그 외에는 같은 도메인의 /api 를 쓴다.
 * 운영 배포(Phase 6)에서 Nginx 가 /api 를 API 서버로 넘겨준다.
 */
export const API_BASE = (() => {
  if (window.STEMCARE_CHAT_API_URL) return window.STEMCARE_CHAT_API_URL.replace(/\/$/, '');
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:4000';
  }
  return window.location.origin;
})();

/** 새 메시지를 확인하는 주기. Phase 4에서 Socket.IO 로 바뀌면 사용하지 않는다. */
export const POLL_INTERVAL_MS = 3000;

/** localStorage 키. 값이 바뀌면 기존 고객의 상담이 끊기므로 함부로 바꾸지 않는다. */
export const STORAGE_KEY = 'scj-chat-session';

/** 맨 아래에서 이 픽셀 이내면 "최신을 보고 있다"고 판단한다. */
export const SCROLL_THRESHOLD_PX = 100;

/** 서버의 @stemcare/shared SERVICE_TYPES 와 반드시 같아야 한다. */
export const SERVICE_TYPES = ['stemcell', 'korea_travel', 'undecided'];

export const ROOM_STATUSES = ['bot', 'waiting', 'active', 'closed'];
