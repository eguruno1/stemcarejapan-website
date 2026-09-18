import type { Message } from '@prisma/client';
import type { ChatRoomStatus } from '@stemcare/shared';
import type { Server } from 'socket.io';
import { identityOf, isSocketAuthorized } from './authSocket';
import { markDeliveredRead } from '../chatRooms/chatRoomService';
import { toMessageDTO } from '../messages/messageMapper';
import { OPERATORS_CHANNEL, roomChannel } from './rooms';

/**
 * 같은 메시지를 고객과 운영자에게 "다른 모양으로" 보낸다.
 *
 * 고객에게 운영자용 DTO 를 그대로 보내면 내부 번역 정보와
 * 운영자가 수정하기 전의 원문이 노출된다. 반드시 나눠 보낸다.
 *
 * 방에 접속한 운영자가 하나라도 있으면, 방금 온 고객 메시지는 이미 읽은 것으로
 * 처리한다 (operatorLastReadAt 갱신). 그래야 방을 열어둔 채 실시간으로 대화하는
 * 동안 unread 배지가 계속 올라가지 않는다.
 */
export async function broadcastMessage(io: Server, roomId: string, row: Message): Promise<void> {
  const channel = roomChannel(roomId);
  let operatorPresent = false;

  for (const [, socket] of io.sockets.sockets) {
    if (!socket.rooms.has(channel)) continue;

    const identity = identityOf(socket);
    if (!identity) continue;
    if (!(await isSocketAuthorized(socket))) { socket.disconnect(true); continue; }
    if (!socket.rooms.has(channel)) continue;

    if (identity.kind === 'operator') operatorPresent = true;

    const viewer = identity.kind === 'customer' ? 'customer' : 'operator';
    socket.emit('chat:message', { message: toMessageDTO(row, viewer) });
  }

  if (operatorPresent && row.senderType === 'customer') {
    await markDeliveredRead(roomId, row.createdAt);
  }

  // 운영자 목록(사이드바)도 갱신이 필요하다.
  io.to(OPERATORS_CHANNEL).emit('rooms:updated', { roomId });
}

/**
 * 이미 화면에 그려진 메시지를 갱신한다. (번역문이 늦게 도착한 경우 등)
 * 클라이언트는 같은 id 의 메시지를 찾아 내용을 바꿔야 한다.
 *
 * broadcastMessage 와 같은 인증·방 멤버십 재확인 패턴을 쓴다 — 순회 중 비동기로
 * isSocketAuthorized 를 기다리는 동안 소켓이 방을 나갔을 수 있어서다.
 */
export async function broadcastMessageUpdate(io: Server, roomId: string, row: Message): Promise<void> {
  const channel = roomChannel(roomId);

  for (const [, socket] of io.sockets.sockets) {
    if (!socket.rooms.has(channel)) continue;

    const identity = identityOf(socket);
    if (!identity) continue;
    if (!(await isSocketAuthorized(socket))) { socket.disconnect(true); continue; }
    if (!socket.rooms.has(channel)) continue;

    const viewer = identity.kind === 'customer' ? 'customer' : 'operator';
    socket.emit('chat:message:update', { message: toMessageDTO(row, viewer) });
  }
}

export function broadcastStatus(
  io: Server,
  roomId: string,
  status: ChatRoomStatus,
  assignedOperatorId: string | null
): void {
  io.to(roomChannel(roomId)).emit('chat:status', { roomId, status, assignedOperatorId });
  io.to(OPERATORS_CHANNEL).emit('rooms:updated', { roomId });
}

/** 신규 상담 접수 등, 방에 들어가 있지 않은 운영자 전원에게 알린다. */
export function notifyOperators(io: Server, payload: { roomId: string; kind: string }): void {
  io.to(OPERATORS_CHANNEL).emit('rooms:new', payload);
  io.to(OPERATORS_CHANNEL).emit('rooms:updated', { roomId: payload.roomId });
}
