import { act, renderHook } from '@testing-library/react';
import type { ChatRoomDetail, MessageDTO, ChatRoomListItem } from '@stemcare/shared';
import { beforeEach, expect, it, vi } from 'vitest';
import { useRoomList } from '@/hooks/useRoomList';
import { useRoomStream } from '@/hooks/useRoomStream';
import { fetchRoom, fetchRooms } from '@/lib/api';
vi.mock('@/lib/api', () => ({ fetchRoom: vi.fn(), fetchRooms: vi.fn() }));
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
const room = (id: string) => ({ id, messages: [], notes: [] } as unknown as ChatRoomDetail);
beforeEach(() => vi.resetAllMocks());
it('늦은 필터 응답이 현재 필터 결과를 덮어쓰지 않는다', async () => {
  const old = deferred<ChatRoomListItem[]>(); const current = deferred<ChatRoomListItem[]>();
  vi.mocked(fetchRooms).mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  const { result } = renderHook(() => useRoomList());
  act(() => result.current.setFilter('waiting'));
  await act(async () => current.resolve([{ id: 'waiting' } as ChatRoomListItem]));
  await act(async () => old.resolve([{ id: 'old' } as ChatRoomListItem]));
  expect(result.current.rooms[0].id).toBe('waiting');
});
it('이전 방에서 완료된 배정·전송 결과를 현재 방에 적용하지 않는다', async () => {
  vi.mocked(fetchRoom).mockImplementation(async id => room(id));
  const { result, rerender } = renderHook(({ id }) => useRoomStream(id), { initialProps: { id: 'a' } });
  await act(async () => {});
  const oldApply = result.current.applyRoom; const oldAppend = result.current.appendMessage;
  rerender({ id: 'b' }); await act(async () => {});
  act(() => oldAppend({ id: 'message-a', chatRoomId: 'a' } as MessageDTO));
  expect(result.current.room?.messages).toEqual([]);
  act(() => oldApply(room('a')));
  expect(result.current.room?.id).toBe('b');
});
it('진행 중인 폴링 응답이 방금 전송한 메시지를 지우지 않는다', async () => {
  vi.mocked(fetchRoom).mockResolvedValueOnce(room('a'));
  const { result } = renderHook(() => useRoomStream('a'));
  await act(async () => {});
  const pending = deferred<ChatRoomDetail>(); vi.mocked(fetchRoom).mockReturnValueOnce(pending.promise);
  let refresh!: Promise<void>; act(() => { refresh = result.current.refresh(); });
  act(() => result.current.appendMessage({ id: 'sent', chatRoomId: 'a' } as MessageDTO));
  await act(async () => { pending.resolve(room('a')); await refresh; });
  expect(result.current.room?.messages.map(m => m.id)).toEqual(['sent']);
});
