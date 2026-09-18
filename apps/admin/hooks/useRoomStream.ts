'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatRoomDetail, ChatRoomStatus, MessageDTO, OperatorNoteDTO } from '@stemcare/shared';
import { fetchRoom } from '@/lib/api';
import { getSocket } from '@/lib/socket';
const POLL_INTERVAL_MS = 3000;

/** 방 이동·쓰기 이후의 늦은 조회가 현재 상태를 되돌리지 않도록 요청을 구분한다. */
export function useRoomStream(roomId: string) {
  const [room, setRoom] = useState<ChatRoomDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtime, setRealtime] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const currentId = useRef(roomId);
  currentId.current = roomId;
  const revision = useRef(0);
  const active = useRef(true);
  const inFlight = useRef<object | null>(null);
  // 인터벌 콜백이 최신 realtime 값을 읽을 수 있게 ref 에도 담아 둔다.
  const realtimeRef = useRef(false);

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
    setRoom(null); setLoading(true); setError(null); setPeerTyping(false);
    void refresh();
    // 소켓이 살아 있는 동안에도 이 폴링은 계속 돈다 — 방화벽 등으로 소켓 이벤트가
    // 조용히 새는 경우를 잡아내는 안전망이다. 서버 부담보다 "안 맞는 화면"이 더 비싸다.
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

  /** chat:status 로 받은 상태·담당자만 갈아끼운다. 메시지/메모는 건드리지 않는다. */
  const applyStatus = useCallback((status: ChatRoomStatus, assignedOperatorId: string | null) => {
    if (!active.current || currentId.current !== roomId) return;
    setRoom(prev => (!prev || prev.id !== roomId ? prev : { ...prev, status, assignedOperatorId }));
  }, [roomId]);

  // 소켓 구독. Phase 4 이후 이 useEffect 하나만 socket.io 를 안다 — 나머지 훅 로직은
  // HTTP 폴링이든 소켓이든 신경 쓰지 않는다.
  useEffect(() => {
    const socket = getSocket();

    function handleConnect() {
      setRealtime(true);
      realtimeRef.current = true;
      socket.emit('chat:join', { roomId });
    }

    function handleDisconnect() {
      setRealtime(false);
      realtimeRef.current = false;
      setPeerTyping(false);
    }

    function handleMessage(payload: { message: MessageDTO }) {
      appendMessage(payload.message);
    }

    function handleStatus(payload: { roomId: string; status: ChatRoomStatus; assignedOperatorId: string | null }) {
      if (payload.roomId !== roomId) return;
      applyStatus(payload.status, payload.assignedOperatorId);
    }

    function handleTyping(payload: { roomId: string; from: string; isTyping: boolean }) {
      if (payload.roomId !== roomId || payload.from !== 'customer') return;
      setPeerTyping(payload.isTyping);
    }

    function handleError(payload: { code: string }) {
      // FORBIDDEN/NOT_FOUND 로 join 이 거부되면 실시간 없이도 3초 폴링이 화면을 채운다.
      console.warn('[chat] socket error', payload.code);
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('chat:message', handleMessage);
    socket.on('chat:status', handleStatus);
    socket.on('chat:typing', handleTyping);
    socket.on('chat:error', handleError);

    // 이미 연결돼 있으면 'connect' 이벤트가 다시 오지 않으므로 직접 join 한다.
    if (socket.connected) handleConnect();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('chat:message', handleMessage);
      socket.off('chat:status', handleStatus);
      socket.off('chat:typing', handleTyping);
      socket.off('chat:error', handleError);
    };
  }, [roomId, appendMessage, applyStatus]);

  return {
    room: room?.id === roomId ? room : null,
    loading,
    error,
    realtime,
    peerTyping,
    refresh,
    applyRoom,
    appendMessage,
    appendNote
  };
}
