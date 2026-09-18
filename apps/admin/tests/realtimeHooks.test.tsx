import { act, renderHook, waitFor } from '@testing-library/react';
import type { ChatRoomDetail, ChatRoomListItem, MessageDTO } from '@stemcare/shared';
import { beforeEach, expect, it, vi } from 'vitest';
import { useRoomList } from '@/hooks/useRoomList';
import { useRoomStream } from '@/hooks/useRoomStream';
import { fetchRoom, fetchRooms } from '@/lib/api';

vi.mock('@/lib/api', () => ({ fetchRoom: vi.fn(), fetchRooms: vi.fn() }));

/** getSocket() 이 돌려주는 가짜 소켓. 서버 이벤트를 __fire 로 흉내 낸다. */
function createFakeSocket() {
  const handlers = new Map<string, Set<(payload?: unknown) => void>>();
  const socket = {
    connected: false,
    on(event: string, handler: (payload?: unknown) => void) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
      return socket;
    },
    off(event: string, handler: (payload?: unknown) => void) {
      handlers.get(event)?.delete(handler);
      return socket;
    },
    emit: vi.fn(),
    __fire(event: string, payload?: unknown) {
      handlers.get(event)?.forEach((h) => h(payload));
    }
  };
  return socket;
}

let fakeSocket: ReturnType<typeof createFakeSocket>;

vi.mock('@/lib/socket', () => ({
  getSocket: () => fakeSocket,
  closeSocket: vi.fn()
}));

const room = (id: string, overrides: Partial<ChatRoomDetail> = {}) =>
  ({ id, status: 'bot', assignedOperatorId: null, messages: [], notes: [], ...overrides } as unknown as ChatRoomDetail);

beforeEach(() => {
  vi.resetAllMocks();
  fakeSocket = createFakeSocket();
});

it('소켓이 연결되면 realtime 이 true 가 되고 그 방에 join 한다', async () => {
  vi.mocked(fetchRoom).mockResolvedValue(room('a'));
  const { result } = renderHook(() => useRoomStream('a'));
  await act(async () => {});

  expect(result.current.realtime).toBe(false);
  act(() => fakeSocket.__fire('connect'));

  expect(result.current.realtime).toBe(true);
  expect(fakeSocket.emit).toHaveBeenCalledWith('chat:join', { roomId: 'a' });
});

it('chat:message 로 온 메시지를 목록에 더한다', async () => {
  vi.mocked(fetchRoom).mockResolvedValue(room('a'));
  const { result } = renderHook(() => useRoomStream('a'));
  await act(async () => {});

  act(() => fakeSocket.__fire('chat:message', { message: { id: 'm1', chatRoomId: 'a' } as MessageDTO }));

  expect(result.current.room?.messages.map((m) => m.id)).toEqual(['m1']);
});

it('다른 방으로 온 chat:message 는 무시한다', async () => {
  vi.mocked(fetchRoom).mockResolvedValue(room('a'));
  const { result } = renderHook(() => useRoomStream('a'));
  await act(async () => {});

  act(() => fakeSocket.__fire('chat:message', { message: { id: 'm1', chatRoomId: 'other-room' } as MessageDTO }));

  expect(result.current.room?.messages).toEqual([]);
});

it('chat:status 로 상태와 담당자를 갱신한다', async () => {
  vi.mocked(fetchRoom).mockResolvedValue(room('a', { status: 'waiting' }));
  const { result } = renderHook(() => useRoomStream('a'));
  await act(async () => {});

  act(() => fakeSocket.__fire('chat:status', { roomId: 'a', status: 'active', assignedOperatorId: 'op-1' }));

  expect(result.current.room?.status).toBe('active');
  expect(result.current.room?.assignedOperatorId).toBe('op-1');
});

it('고객의 chat:typing 만 peerTyping 에 반영한다', async () => {
  vi.mocked(fetchRoom).mockResolvedValue(room('a'));
  const { result } = renderHook(() => useRoomStream('a'));
  await act(async () => {});

  act(() => fakeSocket.__fire('chat:typing', { roomId: 'a', from: 'operator', isTyping: true }));
  expect(result.current.peerTyping).toBe(false);

  act(() => fakeSocket.__fire('chat:typing', { roomId: 'a', from: 'customer', isTyping: true }));
  expect(result.current.peerTyping).toBe(true);
});

it('연결이 끊기면 realtime 이 false 로 돌아가고 입력 중 표시가 꺼진다', async () => {
  vi.mocked(fetchRoom).mockResolvedValue(room('a'));
  const { result } = renderHook(() => useRoomStream('a'));
  await act(async () => {});

  act(() => fakeSocket.__fire('connect'));
  act(() => fakeSocket.__fire('chat:typing', { roomId: 'a', from: 'customer', isTyping: true }));
  expect(result.current.realtime).toBe(true);
  expect(result.current.peerTyping).toBe(true);

  act(() => fakeSocket.__fire('disconnect'));

  expect(result.current.realtime).toBe(false);
  expect(result.current.peerTyping).toBe(false);
});

it('rooms:updated 소켓 이벤트가 오면 목록을 즉시 다시 불러온다', async () => {
  vi.mocked(fetchRooms).mockResolvedValue([{ id: 'r1' } as ChatRoomListItem]);
  renderHook(() => useRoomList());
  await act(async () => {});
  expect(fetchRooms).toHaveBeenCalledTimes(1);

  vi.mocked(fetchRooms).mockResolvedValue([{ id: 'r1' } as ChatRoomListItem, { id: 'r2' } as ChatRoomListItem]);
  act(() => fakeSocket.__fire('rooms:updated', { roomId: 'r2' }));

  await waitFor(() => expect(fetchRooms).toHaveBeenCalledTimes(2));
});
