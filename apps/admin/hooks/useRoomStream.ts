'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatRoomDetail, MessageDTO } from '@stemcare/shared';
import { fetchRoom } from '@/lib/api';

const POLL_INTERVAL_MS = 3000;

/**
 * 상담방 하나의 최신 상태를 유지한다.
 *
 * Phase 4 에서 이 파일 내부만 Socket.IO 구독으로 바꾼다.
 * 반환하는 모양(room/loading/error/refresh/applyRoom/appendMessage)은 그대로 두어야
 * 화면 컴포넌트를 고치지 않아도 된다.
 */
export function useRoomStream(roomId: string) {
  const [room, setRoom] = useState<ChatRoomDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  // 상담방을 빠르게 옮기면 먼저 보낸 요청이 늦게 도착해
  // 이전 고객의 개인정보가 현재 화면에 박힐 수 있다. 세대 번호로 막는다.
  const generationRef = useRef(0);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const generation = generationRef.current;

    try {
      const next = await fetchRoom(roomId);
      if (generation !== generationRef.current) return;
      setRoom(next);
      setError(null);
    } catch (err) {
      if (generation !== generationRef.current) return;
      setError(err instanceof Error ? err.message : '상담을 불러오지 못했습니다.');
    } finally {
      inFlightRef.current = false;
      if (generation === generationRef.current) setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    generationRef.current += 1;
    inFlightRef.current = false;
    setLoading(true);
    setRoom(null);
    setError(null);
    void refresh();
  }, [roomId, refresh]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  /** 배정/상태변경 API 응답을 그대로 반영한다. (다시 조회할 필요 없음) */
  const applyRoom = useCallback((next: ChatRoomDetail) => {
    setRoom(next);
  }, []);

  /** 내가 방금 보낸 메시지를 폴링을 기다리지 않고 즉시 붙인다. */
  const appendMessage = useCallback((message: MessageDTO) => {
    setRoom((prev) => {
      if (!prev) return prev;
      if (prev.messages.some((m) => m.id === message.id)) return prev;
      return { ...prev, messages: [...prev.messages, message] };
    });
  }, []);

  return { room, loading, error, refresh, applyRoom, appendMessage };
}
