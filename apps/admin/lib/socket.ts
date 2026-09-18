'use client';

import { io, type Socket } from 'socket.io-client';
import { API_URL } from './env';

let socket: Socket | null = null;

/**
 * 앱 전체에서 소켓 하나만 쓴다.
 * 컴포넌트마다 연결하면 상담방을 옮길 때마다 연결이 쌓인다.
 *
 * 인증은 httpOnly 쿠키로 한다. withCredentials 를 켜야 쿠키가 핸드셰이크에 실린다.
 */
export function getSocket(): Socket {
  if (socket) return socket;

  socket = io(API_URL, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000
  });

  return socket;
}

export function closeSocket(): void {
  socket?.disconnect();
  socket = null;
}
