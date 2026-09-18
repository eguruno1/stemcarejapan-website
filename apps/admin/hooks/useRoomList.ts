'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatRoomListItem, ChatRoomStatus } from '@stemcare/shared';
import { fetchRooms } from '@/lib/api';

const POLL_INTERVAL_MS = 5000;

export type StatusFilter = ChatRoomStatus | 'all';
export type SortOption = 'recent' | 'oldest_waiting';

export function useRoomList() {
  const [rooms, setRooms] = useState<ChatRoomListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortOption>('recent');

  // 최신 필터 값을 setInterval 콜백이 읽을 수 있게 ref 에 담는다.
  // (state 를 그대로 쓰면 interval 이 만들어질 때의 옛날 값을 계속 본다)
  const filterRef = useRef(filter);
  const sortRef = useRef(sort);
  filterRef.current = filter;
  sortRef.current = sort;

  const load = useCallback(async () => {
    try {
      const next = await fetchRooms({
        status: filterRef.current === 'all' ? undefined : filterRef.current,
        sort: sortRef.current
      });
      setRooms(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '상담 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  // 필터/정렬이 바뀌면 즉시 다시 불러온다.
  useEffect(() => {
    setLoading(true);
    void load();
  }, [filter, sort, load]);

  // 주기적 갱신. Phase 4 에서 Socket 이벤트로 대체한다.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  return { rooms, loading, error, filter, setFilter, sort, setSort, refresh: load };
}
