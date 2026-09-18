import type { Socket } from 'socket.io';
import type { OperatorRole } from '@stemcare/shared';
import { hashVisitorToken, verifyOperatorToken } from '../auth/token';
import { config } from '../config';
import { prisma } from '../db';

export type SocketIdentity =
  | { kind: 'customer'; roomId: string; customerId: string }
  | { kind: 'operator'; operatorId: string; role: OperatorRole };

/**
 * socket.io 의 Socket<...> 는 SocketData 를 제네릭 타입 인자로 받는 클래스라서,
 * `declare module 'socket.io' { interface Socket { data: ... } }` 로 재선언하면
 * 제네릭 기본값(any)과 구체 타입이 충돌해 컴파일 오류가 난다.
 * 그래서 socket.data 는 그대로 두고, 읽고 쓰는 지점을 이 두 함수로 좁힌다.
 */
export function setIdentity(socket: Socket, identity: SocketIdentity): void {
  socket.data.identity = identity;
}

export function identityOf(socket: Socket): SocketIdentity | undefined {
  return socket.data?.identity as SocketIdentity | undefined;
}

/** 쿠키 헤더 문자열에서 값 하나를 꺼낸다. (소켓 핸드셰이크에는 cookie-parser 가 없다) */
function readCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

/**
 * 연결 시점에 단 한 번 신원을 확인한다.
 * next(new Error(...)) 를 호출하면 연결 자체가 거부되고
 * 클라이언트는 'connect_error' 를 받는다. 연결한 뒤에는 권한을 다시 묻지 않는다 —
 * chat:join/chat:message 는 이때 확정된 socket.data.identity 만 믿는다.
 */
export async function authenticateSocket(
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> {
  const auth = socket.handshake.auth ?? {};

  // 1) 운영자: auth.operatorToken 또는 쿠키
  const operatorToken =
    (typeof auth.operatorToken === 'string' ? auth.operatorToken : null) ??
    readCookie(socket.handshake.headers.cookie, config.adminCookieName);

  if (operatorToken) {
    const payload = verifyOperatorToken(operatorToken);
    if (!payload) {
      next(new Error('UNAUTHORIZED'));
      return;
    }

    // HTTP 의 requireOperator 와 같은 기준: 삭제·비활성화된 계정은 유효한 JWT 로도 거부한다.
    const operator = await prisma.operator.findUnique({ where: { id: payload.operatorId } });
    if (!operator || !operator.isActive) {
      next(new Error('UNAUTHORIZED'));
      return;
    }

    setIdentity(socket, { kind: 'operator', operatorId: operator.id, role: payload.role });
    next();
    return;
  }

  // 2) 고객: auth.roomId + auth.visitorToken
  const roomId = typeof auth.roomId === 'string' ? auth.roomId : null;
  const visitorToken = typeof auth.visitorToken === 'string' ? auth.visitorToken : null;

  if (!roomId || !visitorToken) {
    next(new Error('UNAUTHORIZED'));
    return;
  }

  const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
  if (!room || room.visitorTokenHash !== hashVisitorToken(visitorToken)) {
    next(new Error('UNAUTHORIZED'));
    return;
  }

  setIdentity(socket, { kind: 'customer', roomId: room.id, customerId: room.customerId });
  next();
}
