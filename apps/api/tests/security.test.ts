import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createCustomerWithRoom, createOperator } from './helpers/factories';
import { disconnectDatabase, resetDatabase } from './helpers/testDb';

// 다른 테스트 파일들은 로그인 헬퍼를 수십 번씩 호출하므로 테스트 환경의 기본
// rate limit 은 넉넉하다(rateLimitFor 참고 - 요청마다 process.env 를 다시 읽는다).
// 이 파일만 실제 제한 동작을 검증해야 하므로 프로덕션과 같은 값을 명시한다.
process.env.RATE_LIMIT_LOGIN = '10';
process.env.RATE_LIMIT_CHAT_START = '10';

const app = createApp();

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await disconnectDatabase();
});

describe('보안 헤더', () => {
  it('helmet 기본 헤더가 붙는다', async () => {
    const res = await request(app).get('/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('요청 제한 (rate limit)', () => {
  it('로그인을 짧은 시간에 여러 번 시도하면 429 가 난다', async () => {
    await createOperator({ email: 'rl@stemcare.test' });

    const attempts = [];
    for (let i = 0; i < 12; i += 1) {
      attempts.push(
        request(app)
          .post('/api/admin/auth/login')
          .send({ email: 'rl@stemcare.test', password: 'wrong-password-1' })
      );
    }
    const results = await Promise.all(attempts);

    expect(results.some((res) => res.status === 429)).toBe(true);
  });

  it('상담 시작도 과도하게 호출하면 429 가 난다', async () => {
    const attempts = [];
    for (let i = 0; i < 12; i += 1) {
      attempts.push(
        request(app).post('/api/public/chat/start').send({
          name: `연속 ${i}`,
          phone: '010-0000-0000',
          preferredLanguage: 'ko',
          serviceType: 'undecided',
          privacyAgreed: true
        })
      );
    }
    const results = await Promise.all(attempts);

    expect(results.some((res) => res.status === 429)).toBe(true);
  });
});

describe('민감 정보 노출 방지', () => {
  it('로그인 응답에 비밀번호 해시가 없다', async () => {
    const { plainPassword } = await createOperator({ email: 'leak@stemcare.test' });

    const res = await request(app)
      .post('/api/admin/auth/login')
      .send({ email: 'leak@stemcare.test', password: plainPassword });

    expect(JSON.stringify(res.body)).not.toContain('$2');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('서버 오류 응답에 내부 스택이 노출되지 않는다', async () => {
    const res = await request(app)
      .get('/api/public/chat/이건-uuid가-아님')
      .set('X-Visitor-Token', 'x'.repeat(64));

    expect(JSON.stringify(res.body)).not.toContain('prisma');
    expect(JSON.stringify(res.body)).not.toContain('at Object');
  });

  it('고객 응답에 visitorTokenHash 가 없다', async () => {
    const { room, visitorToken } = await createCustomerWithRoom();

    const res = await request(app)
      .get(`/api/public/chat/${room.id}`)
      .set('X-Visitor-Token', visitorToken);

    expect(JSON.stringify(res.body)).not.toContain('visitorTokenHash');
  });
});

describe('운영 환경 설정 검증', () => {
  it('JWT_SECRET 이 기본값이면 오류를 던진다', async () => {
    const { assertProductionConfig } = await import('../src/config');
    const original = { env: process.env.NODE_ENV, secret: process.env.JWT_SECRET };

    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'change-this-in-production';

    expect(() => assertProductionConfig()).toThrow(/JWT_SECRET/);

    process.env.NODE_ENV = original.env;
    process.env.JWT_SECRET = original.secret;
  });
});
