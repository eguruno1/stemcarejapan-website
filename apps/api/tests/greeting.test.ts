import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setModelCaller } from '../src/ai/aiClient';
import { createApp } from '../src/app';
import { prisma } from '../src/db';
import { disconnectDatabase, resetDatabase } from './helpers/testDb';

const app = createApp();

beforeEach(async () => {
  await resetDatabase();
});

afterEach(() => {
  setModelCaller(null);
});

afterAll(async () => {
  await disconnectDatabase();
});

async function settle(ms = 80) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe('AI 첫 인사', () => {
  it('상담을 시작하면 고객 언어로 인사 메시지가 남는다', async () => {
    const res = await request(app)
      .post('/api/public/chat/start')
      .send({
        name: '야마다',
        phone: '+81 90-1111-2222',
        preferredLanguage: 'ja',
        serviceType: 'korea_travel',
        privacyAgreed: true
      })
      .expect(201);

    await settle();

    const greetings = await prisma.message.findMany({
      where: { chatRoomId: res.body.roomId, senderType: 'ai' }
    });

    expect(greetings).toHaveLength(1);
    expect(greetings[0].originalLanguage).toBe('ja');
    // 정형 문구이므로 AI 호출 없이도 항상 만들어져야 한다.
    expect(greetings[0].visibleText.length).toBeGreaterThan(0);
  });

  it('한국어 고객에게는 한국어 인사가 간다', async () => {
    const res = await request(app)
      .post('/api/public/chat/start')
      .send({
        name: '홍길동',
        phone: '010-1111-2222',
        preferredLanguage: 'ko',
        serviceType: 'stemcell',
        privacyAgreed: true
      })
      .expect(201);

    await settle();

    const greeting = await prisma.message.findFirstOrThrow({
      where: { chatRoomId: res.body.roomId, senderType: 'ai' }
    });

    expect(greeting.originalLanguage).toBe('ko');
    expect(greeting.visibleText).toContain('안녕');
  });

  it('AI API 가 없어도 인사는 남는다', async () => {
    setModelCaller(async () => {
      throw new Error('키 없음');
    });

    const res = await request(app)
      .post('/api/public/chat/start')
      .send({
        name: '테스트',
        phone: '010-0000-0000',
        preferredLanguage: 'ko',
        serviceType: 'undecided',
        privacyAgreed: true
      })
      .expect(201);

    await settle();

    const greetings = await prisma.message.findMany({
      where: { chatRoomId: res.body.roomId, senderType: 'ai' }
    });
    expect(greetings.length).toBeGreaterThanOrEqual(1);
  });

  it('인사 메시지 뒤에는 별도의 AI 답변이 곧바로 붙지 않는다', async () => {
    const res = await request(app)
      .post('/api/public/chat/start')
      .send({
        name: '스즈키',
        phone: '+81 90-2222-3333',
        preferredLanguage: 'ja',
        serviceType: 'korea_travel',
        message: '空港のお迎えはできますか。',
        privacyAgreed: true
      })
      .expect(201);

    await settle();

    const messages = await prisma.message.findMany({
      where: { chatRoomId: res.body.roomId },
      orderBy: { createdAt: 'asc' }
    });

    // 가입 폼에 적은 문의는 저장되지만, 그 문의에 대한 개별 AI 답변은 만들지
    // 않는다 - 고정 인사말이 "문의 감사합니다. 방문 시기와 인원을 알려주세요"로
    // 이미 응답을 유도하므로, 인사가 항상 마지막 메시지로 남는다.
    expect(messages.map((m) => m.senderType)).toEqual(['customer', 'ai']);
  });
});
