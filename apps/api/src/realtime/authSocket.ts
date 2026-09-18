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
    if (key === name) {
      try { return decodeURIComponent(rest.join('=')); } catch { return null; }
    }
  }
  return null;
}

/**
 * 연결 시점에 단 한 번 신원을 확인한다.
 * next(new Error(...)) 를 호출하면 연결 자체가 거부되고
 * 클라이언트는 'connect_error' 를 받는다. 연결 후에도 운영자 이벤트·방송 시 토큰 만료와 활성 여부를 재확인한다.
 */
export async function authenticateSocket(
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> {
  const auth = socket.handshake.auth ?? {};

  // 1) 고객: auth.roomId + auth.visitorToken 를 먼저 확인한다.
  //
  // 쿠키는 포트를 구분하지 않는다 — `localhost:3100`(관리자)에 로그인하면 그
  // 쿠키가 `localhost:8080`(고객 위젯)에서 여는 소켓 연결에도 똑같이 실린다.
  // 운영자 쿠키를 먼저 검사하면, 관리자에 로그인해 둔 브라우저로 고객 위젯을
  // 열었을 때 그 연결이 "운영자"로 인증돼 버린다 — 고객이 보낸 메시지가
  // senderType:'operator' 로 저장되고, 고객에게 운영자용(번역 등 내부 정보 포함)
  // DTO 가 그대로 나간다. roomId/visitorToken 이 둘 다 있으면 "나는 이 상담의
  // 고객이다"라는 뜻이 명확하므로, 어떤 쿠키가 실려 왔든 고객으로 인증한다.
  const roomId = typeof auth.roomId === 'string' ? auth.roomId : null;
  const visitorToken = typeof auth.visitorToken === 'string' ? auth.visitorToken : null;

  if (auth.roomId !== undefined || auth.visitorToken !== undefined) {
    if (!roomId || !visitorToken) { next(new Error('UNAUTHORIZED')); return; }
    const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
    if (!room || room.visitorTokenHash !== hashVisitorToken(visitorToken)) {
      next(new Error('UNAUTHORIZED'));
      return;
    }

    setIdentity(socket, { kind: 'customer', roomId: room.id, customerId: room.customerId });
    next();
    return;
  }

  // 2) 운영자: auth.operatorToken(테스트·명시적 토큰 연결) 또는 쿠키(실제 관리자 앱)
  const operatorToken =
    (typeof auth.operatorToken === 'string' ? auth.operatorToken : null) ??
    readCookie(socket.handshake.headers.cookie, config.adminCookieName);

  if (!operatorToken) {
    next(new Error('UNAUTHORIZED'));
    return;
  }

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

  socket.data.operatorToken = operatorToken;
  setIdentity(socket, { kind: 'operator', operatorId: operator.id, role: payload.role });
  next();
}

/** 장시간 연결도 만료·비활성 계정의 권한을 계속 유지하지 않는다. */
export async function isSocketAuthorized(socket: Socket): Promise<boolean> {
  const identity = identityOf(socket);
  if (!identity || !socket.connected) return false;
  if (identity.kind === 'customer') return true;
  const payload = verifyOperatorToken(socket.data.operatorToken ?? '');
  if (!payload || payload.operatorId !== identity.operatorId) return false;
  const operator = await prisma.operator.findUnique({ where: { id: identity.operatorId } });
  return Boolean(operator?.isActive);
}
