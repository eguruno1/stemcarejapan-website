import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setModelCaller } from '../src/ai/aiClient';
import { createApp } from '../src/app';
import { prisma } from '../src/db';
import { createCustomerWithRoom, createOperator } from './helpers/factories';
import { disconnectDatabase, resetDatabase } from './helpers/testDb';

const app = createApp();

async function loginAgent(email = 'tr@stemcare.test') {
  const { operator, plainPassword } = await createOperator({ email });
  const agent = request.agent(app);
  await agent.post('/api/admin/auth/login').send({ email, password: plainPassword });
  return { agent, operator };
}

beforeEach(async () => {
  await resetDatabase();
});

afterEach(() => {
  setModelCaller(null);
});

afterAll(async () => {
  await disconnectDatabase();
});

describe('POST /api/admin/translate/preview', () => {
  it('한국어를 일본어로 번역해서 돌려준다', async () => {
    setModelCaller(async () => 'ご訪問予定日を教えてください。');
    const { agent } = await loginAgent();

    const res = await agent.post('/api/admin/translate/preview').send({
      text: '방문 예정일을 알려주세요.',
      sourceLanguage: 'ko',
      targetLanguage: 'ja'
    });

    expect(res.status).toBe(200);
    expect(res.body.translatedText).toBe('ご訪問予定日を教えてください。');
  });

  it('로그인하지 않으면 401 이다', async () => {
    const res = await request(app).post('/api/admin/translate/preview').send({
      text: '테스트',
      sourceLanguage: 'ko',
      targetLanguage: 'ja'
    });

    expect(res.status).toBe(401);
  });

  it('번역 실패는 503 으로 알린다', async () => {
    setModelCaller(async () => {
      throw new Error('장애');
    });
    const { agent } = await loginAgent();

    const res = await agent.post('/api/admin/translate/preview').send({
      text: '테스트',
      sourceLanguage: 'ko',
      targetLanguage: 'ja'
    });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('TRANSLATION_FAILED');
  });

  it('외부 API 키가 없으면 로컬 제공자 저장 방법을 안내한다', async () => {
    setModelCaller(null);
    const { agent } = await loginAgent();
    const res = await agent.post('/api/admin/translate/preview').send({
      text: '안녕하세요', sourceLanguage: 'ko', targetLanguage: 'ja'
    });
    expect(res.status).toBe(503);
    expect(res.body.error.message).toContain('외부 번역 API 키가 설정되지 않았습니다');
    expect(res.body.error.message).toContain('설정 저장');
    const check = await agent.post('/api/admin/settings/chat/test-translation').send({ provider: 'external' });
    expect(check.body.result.reason).toBe('EXTERNAL_NOT_CONFIGURED');
    expect(check.body.message).toBe(res.body.error.message);
  });

  it('빈 문자열은 400 이다', async () => {
    const { agent } = await loginAgent();

    const res = await agent
      .post('/api/admin/translate/preview')
      .send({ text: '   ', sourceLanguage: 'ko', targetLanguage: 'ja' });

    expect(res.status).toBe(400);
  });

  it('출발어와 도착어가 같으면 400 이다', async () => {
    const { agent } = await loginAgent();

    const res = await agent
      .post('/api/admin/translate/preview')
      .send({ text: '테스트', sourceLanguage: 'ko', targetLanguage: 'ko' });

    expect(res.status).toBe(400);
  });
});

describe('운영자 메시지 전송 시 번역 저장', () => {
  it('자동 번역문을 그대로 보내면 translationStatus 가 done 이다', async () => {
    const { agent } = await loginAgent();
    const { room } = await createCustomerWithRoom({ status: 'active' });

    const res = await agent.post(`/api/admin/chat-rooms/${room.id}/messages`).send({
      originalText: '방문 예정일을 알려주세요.',
      originalLanguage: 'ko',
      translatedText: 'ご訪問予定日を教えてください。',
      translatedLanguage: 'ja'
    });

    expect(res.body.message.translationStatus).toBe('done');
    expect(res.body.message.visibleText).toBe('ご訪問予定日を教えてください。');
  });

  it('운영자가 번역문을 수정해 보내면 edited 로 저장된다', async () => {
    const { agent } = await loginAgent();
    const { room } = await createCustomerWithRoom({ status: 'active' });

    const res = await agent.post(`/api/admin/chat-rooms/${room.id}/messages`).send({
      originalText: '방문 예정일을 알려주세요.',
      originalLanguage: 'ko',
      translatedText: 'ご訪問のご予定日をお知らせください。',
      translatedLanguage: 'ja',
      translationEdited: true
    });

    expect(res.body.message.translationStatus).toBe('edited');
    expect(res.body.message.visibleText).toBe('ご訪問のご予定日をお知らせください。');
    expect(res.body.message.originalText).toBe('방문 예정일을 알려주세요.');
  });

  it('보낸 메시지는 자동 번역 파이프라인을 다시 거치지 않는다', async () => {
    let called = false;
    setModelCaller(async () => {
      called = true;
      return '엉뚱한 재번역';
    });
    const { agent } = await loginAgent();
    const { room } = await createCustomerWithRoom({ status: 'active' });

    await agent.post(`/api/admin/chat-rooms/${room.id}/messages`).send({
      originalText: '방문 예정일을 알려주세요.',
      originalLanguage: 'ko',
      translatedText: 'ご訪問予定日を教えてください。',
      translatedLanguage: 'ja'
    });
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(called).toBe(false);
  });
});

describe('재번역 API', () => {
  it('실패한 번역을 다시 시도해 성공시킨다', async () => {
    const { agent } = await loginAgent();
    const { room, customer } = await createCustomerWithRoom({ preferredLanguage: 'ja' });

    const failed = await prisma.message.create({
      data: {
        chatRoomId: room.id,
        senderType: 'customer',
        senderId: customer.id,
        originalLanguage: 'ja',
        originalText: 'ホテルの予約もお願いできますか。',
        visibleText: 'ホテルの予約もお願いできますか。',
        translationStatus: 'failed'
      }
    });

    setModelCaller(async () => '호텔 예약도 부탁드릴 수 있을까요?');

    const res = await agent.post(
      `/api/admin/chat-rooms/${room.id}/messages/${failed.id}/retranslate`
    );

    expect(res.status).toBe(200);
    expect(res.body.message.translationStatus).toBe('done');
    expect(res.body.message.translatedText).toBe('호텔 예약도 부탁드릴 수 있을까요?');
  });

  it('다른 방의 메시지 ID 는 404 다', async () => {
    const { agent } = await loginAgent();
    const a = await createCustomerWithRoom();
    const b = await createCustomerWithRoom();
    const message = await prisma.message.create({
      data: {
        chatRoomId: a.room.id,
        senderType: 'customer',
        senderId: a.customer.id,
        originalLanguage: 'ja',
        originalText: '테스트',
        visibleText: '테스트',
        translationStatus: 'failed'
      }
    });

    const res = await agent.post(`/api/admin/chat-rooms/${b.room.id}/messages/${message.id}/retranslate`);

    expect(res.status).toBe(404);
  });
});
