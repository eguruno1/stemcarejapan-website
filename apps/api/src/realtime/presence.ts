import type { Server } from 'socket.io';
import { identityOf } from './authSocket';
import { OPERATORS_CHANNEL, roomChannel } from './rooms';

/**
 * 접속 상태는 DB 에 저장하지 않는다.
 *
 * 이유: 소켓 연결은 언제든 끊긴다. DB 에 "접속 중"을 기록하면
 * 서버가 갑자기 죽었을 때 영원히 "접속 중"으로 남는다.
 * Socket.IO 의 현재 연결 목록을 그때그때 세는 것이 항상 정확하다.
 */

/** 지금 로그인해 소켓에 붙어 있는 운영자 수 */
export function countOnlineOperators(io: Server): number {
  return io.sockets.adapter.rooms.get(OPERATORS_CHANNEL)?.size ?? 0;
}

/** 이 상담방을 열어놓고 보고 있는 운영자가 있는가 */
export function isOperatorInRoom(io: Server, roomId: string): boolean {
  const channel = roomChannel(roomId);

  for (const [, socket] of io.sockets.sockets) {
    if (!socket.rooms.has(channel)) continue;
    if (identityOf(socket)?.kind === 'operator') return true;
  }

  return false;
}

/** 한 상담방의 고객에게 현재 접속 상태를 알린다. */
export function broadcastPresence(io: Server, roomId: string): void {
  io.to(roomChannel(roomId)).emit('chat:presence', {
    roomId,
    operatorOnline: isOperatorInRoom(io, roomId),
    anyOperatorOnline: countOnlineOperators(io) > 0
  });
}

/**
 * 운영자가 접속하거나 끊겼을 때, 지금 고객이 보고 있는 모든 상담방에 알린다.
 * 상담방이 아주 많아도 "고객 소켓이 붙어 있는 방"만 대상이므로 부담이 작다.
 */
export function broadcastPresenceToAllCustomerRooms(io: Server): void {
  const roomIds = new Set<string>();

  for (const [, socket] of io.sockets.sockets) {
    const identity = identityOf(socket);
    if (identity?.kind === 'customer') roomIds.add(identity.roomId);
  }

  for (const roomId of roomIds) {
    broadcastPresence(io, roomId);
  }
}
