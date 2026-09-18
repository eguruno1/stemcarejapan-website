import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { OperatorRole } from '@stemcare/shared';
import { config } from '../config';

export interface OperatorTokenPayload {
  operatorId: string;
  role: OperatorRole;
}

const OPERATOR_TOKEN_TTL = '12h';

export function signOperatorToken(payload: OperatorTokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: OPERATOR_TOKEN_TTL });
}

export function verifyOperatorToken(token: string): OperatorTokenPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (typeof decoded !== 'object' || decoded === null) return null;

    const { operatorId, role } = decoded as Partial<OperatorTokenPayload>;
    if (typeof operatorId !== 'string' || (role !== 'admin' && role !== 'operator')) return null;

    return { operatorId, role };
  } catch {
    // 만료, 서명 불일치, 형식 오류를 모두 "인증 실패" 하나로 취급한다.
    return null;
  }
}

/** 고객 브라우저에게 주는 상담방 접근용 임시 토큰 (원본) */
export function createVisitorToken(): string {
  return randomBytes(32).toString('hex');
}

/** DB에는 원본이 아니라 이 해시만 저장한다. */
export function hashVisitorToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
