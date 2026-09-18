'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatRoomDetail, MessageDTO, OperatorNoteDTO } from '@stemcare/shared';
import { fetchRoom } from '@/lib/api';
const POLL_INTERVAL_MS = 3000;

/** 방 이동·쓰기 이후의 늦은 조회가 현재 상태를 되돌리지 않도록 요청을 구분한다. */
export function useRoomStream(roomId: string) {
  const [room, setRoom] = useState<ChatRoomDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentId = useRef(roomId);
  currentId.current = roomId;
  const revision = useRef(0);
  const active = useRef(true);
  const inFlight = useRef<object | null>(null);

  const refresh = useCallback(async () => {
    if (!active.current || currentId.current !== roomId || inFlight.current) return;
    const request = {};
    const version = revision.current;
    inFlight.current = request;
    const isCurrent = () => active.current && currentId.current === roomId && version === revision.current;
    try {
      const next = await fetchRoom(roomId);
      if (!isCurrent()) return;
      setRoom(next);
      setError(null);
    } catch (err) {
      if (isCurrent()) setError(err instanceof Error ? err.message : '상담을 불러오지 못했습니다.');
    } finally {
      if (inFlight.current === request) inFlight.current = null;
      if (isCurrent()) setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    active.current = true;
    revision.current += 1;
    inFlight.current = null;
    setRoom(null); setLoading(true); setError(null);
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, POLL_INTERVAL_MS);
    return () => {
      active.current = false;
      revision.current += 1;
      inFlight.current = null;
      window.clearInterval(timer);
    };
  }, [refresh]);

  const invalidateRead = useCallback(() => {
    revision.current += 1;
    inFlight.current = null;
    setError(null);
    setLoading(false);
  }, []);

  const applyRoom = useCallback((next: ChatRoomDetail) => {
    if (!active.current || currentId.current !== roomId || next.id !== roomId) return;
    invalidateRead();
    setRoom(prev => {
      if (!prev || prev.id !== next.id) return next;
      // 상태 변경 응답이 생성된 뒤 도착한 메시지·메모도 보존한다.
      const messages = new Map(prev.messages.map(m => [m.id, m]));
      next.messages.forEach(m => messages.set(m.id, m));
      const notes = new Map(prev.notes.map(n => [n.id, n]));
      next.notes.forEach(n => notes.set(n.id, n));
      return { ...next, messages: [...messages.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
        notes: [...notes.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
    });
  }, [roomId, invalidateRead]);

  const appendMessage = useCallback((message: MessageDTO) => {
    if (!active.current || currentId.current !== roomId || message.chatRoomId !== roomId) return;
    invalidateRead();
    setRoom(prev => !prev || prev.id !== roomId || prev.messages.some(m => m.id === message.id)
      ? prev : { ...prev, messages: [...prev.messages, message] });
  }, [roomId, invalidateRead]);

  const appendNote = useCallback((note: OperatorNoteDTO) => {
    if (!active.current || currentId.current !== roomId) return;
    invalidateRead();
    setRoom(prev => !prev || prev.id !== roomId || prev.notes.some(n => n.id === note.id)
      ? prev : { ...prev, notes: [note, ...prev.notes] });
  }, [roomId, invalidateRead]);

  return { room: room?.id === roomId ? room : null, loading, error, refresh, applyRoom, appendMessage, appendNote };
}
