'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatRoomListItem, ChatRoomStatus } from '@stemcare/shared';
import { fetchRooms } from '@/lib/api';
import { getSocket } from '@/lib/socket';
const POLL_INTERVAL_MS = 5000;
export type StatusFilter = ChatRoomStatus | 'all';
export type SortOption = 'recent' | 'oldest_waiting';

export function useRoomList() {
  const [rooms, setRooms] = useState<ChatRoomListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortOption>('recent');
  const requestRef = useRef<object | null>(null);
  const generation = useRef(0);
  const reloadRequested = useRef(false);
  const load = useCallback(async () => {
    if (requestRef.current) { reloadRequested.current = true; return; }
    const request = {}; const version = generation.current;
    requestRef.current = request;
    reloadRequested.current = false;
    try {
      const next = await fetchRooms({ status: filter === 'all' ? undefined : filter, sort });
      if (version !== generation.current) return;
      setRooms(next); setError(null);
    } catch (err) {
      if (version === generation.current) setError(err instanceof Error ? err.message : '상담 목록을 불러오지 못했습니다.');
    } finally {
      if (requestRef.current === request) requestRef.current = null;
      if (version === generation.current) {
        setLoading(false);
        if (reloadRequested.current) void load();
      }
    }
  }, [filter, sort]);
  useEffect(() => {
    generation.current += 1; requestRef.current = null;
    setRooms([]); setLoading(true); setError(null);
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_INTERVAL_MS);
    return () => { generation.current += 1; requestRef.current = null; window.clearInterval(timer); };
  }, [load]);

  // 소켓이 알려주면 5초를 기다리지 않고 즉시 다시 불러온다.
  // 5초 폴링은 그대로 둔다 — 소켓이 막힌 환경에서 목록이 멈추면 안 되기 때문이다.
  useEffect(() => {
    const socket = getSocket();
    function handleUpdate() {
      void load();
    }
    socket.on('connect', handleUpdate);
    socket.on('rooms:updated', handleUpdate);
    socket.on('rooms:new', handleUpdate);
    return () => {
      socket.off('connect', handleUpdate);
      socket.off('rooms:updated', handleUpdate);
      socket.off('rooms:new', handleUpdate);
    };
  }, [load]);

  return { rooms, loading, error, filter, setFilter, sort, setSort, refresh: load };
}
