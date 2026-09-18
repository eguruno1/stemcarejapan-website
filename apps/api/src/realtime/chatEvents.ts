import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { AppError } from '../common/errors';
import { identityOf } from './authSocket';
import { prisma } from '../db';
import { requestHandoff } from '../chatRooms/chatRoomService';
import { createMessageRow, listMessages } from '../messages/messageService';
import { toMessageDTO } from '../messages/messageMapper';
import { broadcastMessage, broadcastStatus } from './emitters';
import { broadcastPresence } from './presence';
import { roomChannel, roomIdOf } from './rooms';

const JoinSchema = z.object({ roomId: z.string().uuid() });

const MessageSchema = z.object({
  roomId: z.string().uuid(),
  text: z.string().trim().min(1).max(2000),
  clientMessageId: z.string().trim().min(1).max(100)
});

const TypingSchema = z.object({ roomId: z.string().uuid(), isTyping: z.boolean() });

const HandoffSchema = z.object({
  roomId: z.string().uuid(),
  reason: z.string().max(100).optional()
});

function emitError(socket: Socket, code: string, message: string): void {
  socket.emit('chat:error', { code, message });
}

/** 이 소켓이 해당 상담방을 다룰 권한이 있는지 확인한다. */
function assertRoomAccess(socket: Socket, roomId: string): void {
  const identity = identityOf(socket)!;
  if (identity.kind === 'customer' && identity.roomId !== roomId) {
    throw new AppError(403, 'FORBIDDEN', '이 상담방에 접근할 권한이 없습니다.');
  }
}

export function registerChatEvents(io: Server, socket: Socket): void {
  const identity = identityOf(socket)!;

  /** 모든 핸들러를 감싸 오류를 chat:error 로 바꿔준다. */
  function handle<T>(schema: z.ZodSchema<T>, fn: (input: T) => Promise<void>) {
    return async (raw: unknown) => {
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        emitError(socket, 'VALIDATION_ERROR', '잘못된 요청입니다.');
        return;
      }

      try {
        await fn(parsed.data);
      } catch (err) {
        if (err instanceof AppError) {
          emitError(socket, err.code, err.message);
          return;
        }
        console.error('[socket] unhandled', err);
        emitError(socket, 'INTERNAL_ERROR', '처리 중 문제가 발생했습니다.');
      }
    };
  }

  socket.on(
    'chat:join',
    handle(JoinSchema, async ({ roomId }) => {
      assertRoomAccess(socket, roomId);

      const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
      if (!room) throw new AppError(404, 'NOT_FOUND', '상담방을 찾을 수 없습니다.');

      await socket.join(roomChannel(roomId));

      const viewer = identity.kind === 'customer' ? 'customer' : 'operator';
      socket.emit('chat:joined', {
        roomId: room.id,
        status: room.status,
        assignedOperatorId: room.assignedOperatorId,
        messages: await listMessages(roomId, viewer)
      });

      // 방 참가자가 바뀌었으므로(내가 막 들어왔으므로) 접속 상태를 다시 알린다.
      broadcastPresence(io, roomId);
    })
  );

  socket.on(
    'chat:message',
    handle(MessageSchema, async ({ roomId, text, clientMessageId }) => {
      assertRoomAccess(socket, roomId);

      let originalLanguage: 'ko' | 'ja' | 'unknown' = 'unknown';
      let senderId: string | null = null;

      if (identity.kind === 'customer') {
        const customer = await prisma.customer.findUniqueOrThrow({ where: { id: identity.customerId } });
        originalLanguage = customer.preferredLanguage as 'ko' | 'ja';
        senderId = customer.id;
      } else {
        // 운영자 기본 작성 언어는 한국어다. (Phase 5 에서 자동 감지로 바뀐다)
        originalLanguage = 'ko';
        senderId = identity.operatorId;
      }

      // createMessageRow 가 방 잠금 안에서 존재 확인·종료 확인·clientMessageId 충돌
      // 검사를 전부 수행한다. HTTP 라우트와 완전히 같은 검증 로직이다.
      const row = await createMessageRow({
        chatRoomId: roomId,
        senderType: identity.kind === 'customer' ? 'customer' : 'operator',
        senderId,
        text,
        originalLanguage,
        clientMessageId
      });

      // 방 전체에 알린다. (보낸 사람도 포함 — 다른 기기/탭에서 보고 있을 수 있다)
      await broadcastMessage(io, roomId, row);

      // 보낸 사람에게는 "네가 보낸 그 메시지가 이거다"를 따로 알려준다.
      const viewer = identity.kind === 'customer' ? 'customer' : 'operator';
      socket.emit('chat:message:ack', {
        clientMessageId,
        message: toMessageDTO(row, viewer)
      });
    })
  );

  socket.on(
    'chat:typing',
    handle(TypingSchema, async ({ roomId, isTyping }) => {
      assertRoomAccess(socket, roomId);

      // socket.to(...) 는 "나를 제외한" 방 참가자에게 보낸다.
      socket.to(roomChannel(roomId)).emit('chat:typing', {
        roomId,
        from: identity.kind,
        isTyping
      });
    })
  );

  socket.on(
    'chat:handoff-request',
    handle(HandoffSchema, async ({ roomId }) => {
      assertRoomAccess(socket, roomId);

      // 상태 전환은 chatRoomService.requestHandoff 가 다른 쓰기와 같은 방 잠금으로
      // 수행한다. 소켓 핸들러가 직접 prisma.update 를 부르지 않는다.
      const { status, assignedOperatorId, notice } = await requestHandoff(roomId);

      if (notice) {
        await broadcastMessage(io, roomId, notice);
        broadcastStatus(io, roomId, status, assignedOperatorId);
      }
    })
  );

  socket.on('disconnect', () => {
    // 이 소켓이 보고 있던 상담방들의 접속 상태를 갱신한다.
    // Socket.IO 는 disconnect 이벤트를 먼저 쏘고 그 다음에 룸에서 소켓을 뺀다.
    // 그래서 바로 세면 방금 나간 소켓이 아직 집계에 남아 있다 — 다음 틱으로 미룬다.
    const watchedRoomIds = [...socket.rooms].map(roomIdOf).filter((id): id is string => id !== null);

    setImmediate(() => {
      for (const roomId of watchedRoomIds) broadcastPresence(io, roomId);
    });
  });
}
