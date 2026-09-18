import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { config } from '../src/config';
import { createOperator } from './helpers/factories';
import { disconnectDatabase, resetDatabase } from './helpers/testDb';

const app = createApp();

describe('운영자 인증', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('올바른 이메일/비밀번호로 로그인하면 운영자 정보와 쿠키를 받는다', async () => {
    const { operator, plainPassword } = await createOperator({ email: 'op@stemcare.test' });

    const res = await request(app)
      .post('/api/admin/auth/login')
      .send({ email: 'op@stemcare.test', password: plainPassword });

    expect(res.status).toBe(200);
    expect(res.body.operator).toMatchObject({ id: operator.id, email: 'op@stemcare.test' });
    // 비밀번호 해시가 응답에 절대 섞이면 안 된다.
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');

    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toContain(config.adminCookieName);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('비밀번호가 틀리면 401 을 반환한다', async () => {
    await createOperator({ email: 'op@stemcare.test' });

    const res = await request(app)
      .post('/api/admin/auth/login')
      .send({ email: 'op@stemcare.test', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('없는 이메일도 "비밀번호 틀림"과 같은 응답을 준다', async () => {
    const res = await request(app)
      .post('/api/admin/auth/login')
      .send({ email: 'nobody@stemcare.test', password: 'whatever-1234' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('비활성화된 계정은 로그인할 수 없다', async () => {
    const { plainPassword } = await createOperator({ email: 'off@stemcare.test', isActive: false });

    const res = await request(app)
      .post('/api/admin/auth/login')
      .send({ email: 'off@stemcare.test', password: plainPassword });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('OPERATOR_DISABLED');
  });

  it('이메일 형식이 아니면 400 을 반환한다', async () => {
    const res = await request(app)
      .post('/api/admin/auth/login')
      .send({ email: '이메일아님', password: 'whatever-1234' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('로그인 없이 /me 를 호출하면 401 이다', async () => {
    const res = await request(app).get('/api/admin/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('로그인 쿠키를 가지고 /me 를 호출하면 본인 정보가 온다', async () => {
    const { operator, plainPassword } = await createOperator({ email: 'me@stemcare.test' });
    const agent = request.agent(app);
    await agent.post('/api/admin/auth/login').send({ email: 'me@stemcare.test', password: plainPassword });

    const res = await agent.get('/api/admin/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.operator.id).toBe(operator.id);
  });

  it('로그아웃하면 쿠키가 지워지고 /me 가 다시 401 이 된다', async () => {
    const { plainPassword } = await createOperator({ email: 'bye@stemcare.test' });
    const agent = request.agent(app);
    await agent.post('/api/admin/auth/login').send({ email: 'bye@stemcare.test', password: plainPassword });

    await agent.post('/api/admin/auth/logout').expect(200);
    const res = await agent.get('/api/admin/auth/me');

    expect(res.status).toBe(401);
  });
});
