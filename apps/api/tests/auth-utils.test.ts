import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/auth/password';
import {
  createVisitorToken,
  hashVisitorToken,
  signOperatorToken,
  verifyOperatorToken
} from '../src/auth/token';

describe('비밀번호', () => {
  it('해시는 평문과 다르고, 같은 평문으로 검증하면 통과한다', async () => {
    const hash = await hashPassword('super-secret-1234');

    expect(hash).not.toBe('super-secret-1234');
    expect(await verifyPassword('super-secret-1234', hash)).toBe(true);
  });

  it('틀린 비밀번호는 검증에 실패한다', async () => {
    const hash = await hashPassword('super-secret-1234');

    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('같은 평문이어도 매번 다른 해시가 나온다 (salt)', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');

    expect(a).not.toBe(b);
  });
});

describe('운영자 JWT', () => {
  it('발급한 토큰을 검증하면 payload 가 돌아온다', () => {
    const token = signOperatorToken({ operatorId: 'op-1', role: 'operator' });

    expect(verifyOperatorToken(token)).toMatchObject({ operatorId: 'op-1', role: 'operator' });
  });

  it('조작된 토큰은 null 을 반환한다', () => {
    const token = signOperatorToken({ operatorId: 'op-1', role: 'operator' });

    expect(verifyOperatorToken(token + 'x')).toBeNull();
    expect(verifyOperatorToken('완전히-이상한-값')).toBeNull();
  });
});

describe('방문자 토큰', () => {
  it('64자 hex 문자열을 만든다', () => {
    expect(createVisitorToken()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('매번 다른 값이 나온다', () => {
    expect(createVisitorToken()).not.toBe(createVisitorToken());
  });

  it('해시는 같은 입력에 항상 같은 값을 낸다', () => {
    const token = createVisitorToken();

    expect(hashVisitorToken(token)).toBe(hashVisitorToken(token));
    expect(hashVisitorToken(token)).not.toBe(token);
  });
});
