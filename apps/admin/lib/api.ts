import type {
  ChatRoomDetail,
  ChatRoomListItem,
  ChatRoomStatus,
  Language,
  MessageDTO,
  OperatorDTO,
  OperatorNoteDTO
} from '@stemcare/shared';
import { API_URL } from './env';

export class AdminApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

async function request<T>(
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method: init.method ?? 'GET',
      headers: { 'Content-Type': 'application/json' },
      // 이게 없으면 httpOnly 쿠키가 전송되지 않아 항상 401 이 난다.
      credentials: 'include',
      body: init.body === undefined ? undefined : JSON.stringify(init.body)
    });
  } catch {
    throw new AdminApiError(0, 'NETWORK_ERROR', 'API 서버에 연결할 수 없습니다.');
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new AdminApiError(
      response.status,
      payload?.error?.code ?? 'UNKNOWN_ERROR',
      payload?.error?.message ?? `HTTP ${response.status}`
    );
  }

  return payload as T;
}

/* ---------- 인증 ---------- */

export async function login(email: string, password: string): Promise<OperatorDTO> {
  const res = await request<{ operator: OperatorDTO }>('/api/admin/auth/login', {
    method: 'POST',
    body: { email, password }
  });
  return res.operator;
}

export async function logout(): Promise<void> {
  await request<{ ok: true }>('/api/admin/auth/logout', { method: 'POST' });
}

export async function fetchMe(): Promise<OperatorDTO> {
  const res = await request<{ operator: OperatorDTO }>('/api/admin/auth/me');
  return res.operator;
}

/* ---------- 상담방 ---------- */

export async function fetchRooms(
  params: {
    status?: ChatRoomStatus;
    mine?: boolean;
    sort?: 'recent' | 'oldest_waiting';
  } = {}
): Promise<ChatRoomListItem[]> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.mine) query.set('mine', 'true');
  if (params.sort) query.set('sort', params.sort);

  const suffix = query.toString() ? `?${query.toString()}` : '';
  const res = await request<{ rooms: ChatRoomListItem[] }>(`/api/admin/chat-rooms${suffix}`);
  return res.rooms;
}

export async function fetchRoom(roomId: string): Promise<ChatRoomDetail> {
  const res = await request<{ room: ChatRoomDetail }>(
    `/api/admin/chat-rooms/${encodeURIComponent(roomId)}`
  );
  return res.room;
}

export async function assignRoom(roomId: string): Promise<ChatRoomDetail> {
  const res = await request<{ room: ChatRoomDetail }>(
    `/api/admin/chat-rooms/${encodeURIComponent(roomId)}/assign`,
    { method: 'PATCH' }
  );
  return res.room;
}

export async function changeStatus(
  roomId: string,
  status: ChatRoomStatus
): Promise<ChatRoomDetail> {
  const res = await request<{ room: ChatRoomDetail }>(
    `/api/admin/chat-rooms/${encodeURIComponent(roomId)}/status`,
    { method: 'PATCH', body: { status } }
  );
  return res.room;
}

export async function sendOperatorMessage(
  roomId: string,
  body: {
    originalText: string;
    originalLanguage: Language;
    translatedText?: string;
    translatedLanguage?: Language;
    clientMessageId?: string;
  }
): Promise<MessageDTO> {
  const res = await request<{ message: MessageDTO }>(
    `/api/admin/chat-rooms/${encodeURIComponent(roomId)}/messages`,
    { method: 'POST', body }
  );
  return res.message;
}

export async function createNote(roomId: string, note: string): Promise<OperatorNoteDTO> {
  const res = await request<{ note: OperatorNoteDTO }>(
    `/api/admin/chat-rooms/${encodeURIComponent(roomId)}/notes`,
    { method: 'POST', body: { note } }
  );
  return res.note;
}
