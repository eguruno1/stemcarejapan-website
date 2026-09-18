import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { AppError } from '../common/errors';
import { logError } from '../common/logger';
import { identityOf, isSocketAuthorized } from './authSocket';
import { prisma } from '../db';
import { runBotTurn } from '../ai/consultationBot';
import { translateMessageInBackground } from '../ai/translationPipeline';
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

function emitError(socket: Socket, code: string, message: string, extra?: Record<string, unknown>): void {
  socket.emit('chat:error', { code, message, ...extra });
}

/** raw 입력이나 파싱된 입력 어느 쪽에서든 clientMessageId 를 안전하게 꺼낸다. */
function clientMessageIdOf(input: unknown): Record<string, unknown> {
  const value = (input as { clientMessageId?: unknown } | null)?.clientMessageId;
  return typeof value === 'string' ? { clientMessageId: value } : {};
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

  /**
   * schema 로 검증 후 fn 을 실행하고, 어느 단계에서 실패하든 chat:error 로 바꿔준다.
   *
   * errorContext 는 실패한 입력(raw 또는 파싱된 값)에서 클라이언트가 실패를 특정
   * 메시지에 되돌려 붙일 수 있는 값(clientMessageId)을 뽑아 오류에 함께 실어 보낸다.
   * 이게 없으면, 소켓으로 보낸 메시지가 서버에서 거부됐을 때 위젯의 "전송 중" 말풍선이
   * 영영 확정되지도 실패 표시되지도 않은 채 남는다 — ack(성공)도 error(실패, 대상 불명)도
   * 그 말풍선을 가리키지 못하기 때문이다.
   */
  let eventQueue = Promise.resolve();
  function handle<T>(
    schema: z.ZodSchema<T>,
    fn: (input: T) => Promise<void>,
    errorContext: (input: unknown) => Record<string, unknown> = () => ({})
  ) {
    return (raw: unknown) => {
      eventQueue = eventQueue.then(async () => {
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        emitError(socket, 'VALIDATION_ERROR', '잘못된 요청입니다.', errorContext(raw));
        return;
      }

      try {
        if (!(await isSocketAuthorized(socket))) {
          emitError(socket, 'UNAUTHORIZED', '다시 로그인해주세요.', errorContext(parsed.data));
          socket.disconnect(true);
          return;
        }
        await fn(parsed.data);
      } catch (err) {
        const extra = errorContext(parsed.data);
        if (err instanceof AppError) {
          emitError(socket, err.code, err.message, extra);
          return;
        }
        logError(err, 'socket_unhandled');
        emitError(socket, 'INTERNAL_ERROR', '처리 중 문제가 발생했습니다.', extra);
      }
      });
      return eventQueue;
    };
  }

  socket.on(
    'chat:join',
    handle(JoinSchema, async ({ roomId }) => {
      assertRoomAccess(socket, roomId);

      const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
      if (!room) throw new AppError(404, 'NOT_FOUND', '상담방을 찾을 수 없습니다.');

      // 한 소켓은 현재 화면의 방 하나만 구독한다.
      for (const channel of [...socket.rooms]) {
        const previous = roomIdOf(channel);
        if (previous && previous !== roomId) {
          await socket.leave(channel);
          broadcastPresence(io, previous);
        }
      }
      if (!socket.connected) return;
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

  socket.on('chat:leave', handle(JoinSchema, async ({ roomId }) => {
    assertRoomAccess(socket, roomId);
    await socket.leave(roomChannel(roomId));
    broadcastPresence(io, roomId);
    socket.emit('chat:left', { roomId });
  }));

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

      // 재전송(같은 clientMessageId)인지 미리 알아둔다 - AI 턴은 새 메시지에만 돌려야
      // 한다. 재전송에도 매번 돌리면 같은 입력에 안내 문구나 답변이 중복 생성된다.
      const isRetry = Boolean(
        await prisma.message.findUnique({
          where: { chatRoomId_clientMessageId: { chatRoomId: roomId, clientMessageId } }
        })
      );

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

      // 원문을 먼저 전달한 뒤 번역을 시작한다. await 하지 않는다 — 번역이 몇 초
      // 걸려도 메시지 전달은 이미 끝나 있어야 한다. 운영자가 미리보기로 번역을
      // 붙여 보내는 메시지(Task 4)는 여기서 번역하지 않는다 — 대상 언어가 반대다.
      // 고객 메시지에만 AI 가 반응한다. 번역과 병렬로 진행된다.
      if (identity.kind === 'customer') {
        void translateMessageInBackground(io, row.id);
        if (!isRetry) void runBotTurn(io, roomId);
      }
    }, clientMessageIdOf)
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
      }
      broadcastStatus(io, roomId, status, assignedOperatorId);
    })
  );

  socket.on('disconnecting', () => {
    // 이 소켓이 보고 있던 상담방들의 접속 상태를 갱신한다.
    // disconnecting 시점에만 참가 중인 룸 목록이 남아 있다.
    // 그래서 바로 세면 방금 나간 소켓이 아직 집계에 남아 있다 — 다음 틱으로 미룬다.
    const watchedRoomIds = [...socket.rooms].map(roomIdOf).filter((id): id is string => id !== null);

    setImmediate(() => {
      for (const roomId of watchedRoomIds) broadcastPresence(io, roomId);
    });
  });
}
