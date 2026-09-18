import { describe, expect, it } from 'vitest';
import { maskPersonalData } from '../src/common/logger';

describe('maskPersonalData', () => {
  it('이름을 마스킹한다', () => {
    const masked = maskPersonalData({ name: '야마다 타로', roomId: 'r1' }) as Record<string, unknown>;

    expect(masked.name).toBe('[REDACTED]');
    expect(masked.roomId).toBe('r1');
  });

  it('전화번호와 이메일을 마스킹한다', () => {
    const masked = maskPersonalData({
      phone: '+81 90-1234-5678',
      email: 'yamada@example.com'
    }) as Record<string, unknown>;

    expect(masked.phone).toBe('[REDACTED]');
    expect(masked.email).toBe('[REDACTED]');
  });

  it('상담 본문을 마스킹한다', () => {
    const masked = maskPersonalData({
      originalText: '来月、母と2人で韓国に行きたいです。',
      translatedText: '다음 달에 어머니와 갑니다',
      visibleText: '来月'
    }) as Record<string, unknown>;

    expect(masked.originalText).toBe('[REDACTED]');
    expect(masked.translatedText).toBe('[REDACTED]');
    expect(masked.visibleText).toBe('[REDACTED]');
  });

  it('비밀번호와 토큰을 마스킹한다', () => {
    const masked = maskPersonalData({
      password: 'secret',
      passwordHash: '$2a$10$abc',
      visitorToken: 'a'.repeat(64),
      authorization: 'Bearer xyz'
    }) as Record<string, unknown>;

    expect(masked.password).toBe('[REDACTED]');
    expect(masked.passwordHash).toBe('[REDACTED]');
    expect(masked.visitorToken).toBe('[REDACTED]');
    expect(masked.authorization).toBe('[REDACTED]');
  });

  it('중첩된 객체도 마스킹한다', () => {
    const masked = maskPersonalData({
      room: { id: 'r1', customer: { name: '홍길동', phone: '010-1111-2222' } }
    }) as any;

    expect(masked.room.id).toBe('r1');
    expect(masked.room.customer.name).toBe('[REDACTED]');
  });

  it('배열도 마스킹한다', () => {
    const masked = maskPersonalData([{ name: '홍길동' }, { name: '김철수' }]) as any[];

    expect(masked[0].name).toBe('[REDACTED]');
    expect(masked[1].name).toBe('[REDACTED]');
  });

  it('안전한 필드는 그대로 둔다', () => {
    const masked = maskPersonalData({
      roomId: 'r1',
      status: 'active',
      durationMs: 120,
      translationStatus: 'done'
    }) as Record<string, unknown>;

    expect(masked).toEqual({
      roomId: 'r1',
      status: 'active',
      durationMs: 120,
      translationStatus: 'done'
    });
  });
});

it('대소문자·깊은 중첩·평가 의견·예외 상세에서도 개인정보를 반환하지 않는다', () => {
  const value = { CustomerName: '누출1', comment: '누출2', reason: '누출3', nested: { a: { b: { c: { d: { e: { f: { phone: '누출4' } } } } } } } };
  expect(JSON.stringify(maskPersonalData(value))).not.toContain('누출');
});
