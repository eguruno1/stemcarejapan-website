import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setModelCaller } from '../src/ai/aiClient';
import { translateMessageInBackground } from '../src/ai/translationPipeline';
import { prisma } from '../src/db';
import { createMessageRow } from '../src/messages/messageService';
import { createCustomerWithRoom } from './helpers/factories';
import { disconnectDatabase, resetDatabase } from './helpers/testDb';

/** 백그라운드 작업이 끝날 때까지 잠시 기다린다. */
async function settle(ms = 60): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
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

describe('메시지 자동 번역', () => {
  it('일본어 고객 메시지에 한국어 번역이 붙는다', async () => {
    setModelCaller(async () => '다음 달에 어머니와 2명이서 한국에 가고 싶습니다.');
    const { room, customer } = await createCustomerWithRoom({ preferredLanguage: 'ja' });

    const row = await createMessageRow({
      chatRoomId: room.id,
      senderType: 'customer',
      senderId: customer.id,
      text: '来月、母と2人で韓国に行きたいです。',
      originalLanguage: 'ja'
    });

    await translateMessageInBackground(null, row.id);
    await settle();

    const updated = await prisma.message.findUniqueOrThrow({ where: { id: row.id } });
    expect(updated.translationStatus).toBe('done');
    expect(updated.translatedLanguage).toBe('ko');
    expect(updated.translatedText).toBe('다음 달에 어머니와 2명이서 한국에 가고 싶습니다.');
    // 고객이 보는 문장은 여전히 본인이 쓴 원문이어야 한다.
    expect(updated.visibleText).toBe('来月、母と2人で韓国に行きたいです。');
  });

  it('번역이 실패하면 failed 로 저장되고 원문은 그대로 남는다', async () => {
    setModelCaller(async () => {
      throw new Error('서비스 장애');
    });
    const { room, customer } = await createCustomerWithRoom({ preferredLanguage: 'ja' });

    const row = await createMessageRow({
      chatRoomId: room.id,
      senderType: 'customer',
      senderId: customer.id,
      text: 'ホテルの予約もお願いできますか。',
      originalLanguage: 'ja'
    });

    await translateMessageInBackground(null, row.id);
    await settle();

    const updated = await prisma.message.findUniqueOrThrow({ where: { id: row.id } });
    expect(updated.translationStatus).toBe('failed');
    expect(updated.translatedText).toBeNull();
    expect(updated.originalText).toBe('ホテルの予約もお願いできますか。');
  });

  it('한국어 고객 메시지는 번역하지 않는다', async () => {
    let called = false;
    setModelCaller(async () => {
      called = true;
      return '무언가';
    });
    const { room, customer } = await createCustomerWithRoom({ preferredLanguage: 'ko' });

    const row = await createMessageRow({
      chatRoomId: room.id,
      senderType: 'customer',
      senderId: customer.id,
      text: '안녕하세요, 상담 부탁드립니다.',
      originalLanguage: 'ko'
    });

    await translateMessageInBackground(null, row.id);
    await settle();

    expect(called).toBe(false);
    const updated = await prisma.message.findUniqueOrThrow({ where: { id: row.id } });
    expect(updated.translationStatus).toBe('none');
  });

  it('시스템 메시지는 번역하지 않는다', async () => {
    let called = false;
    setModelCaller(async () => {
      called = true;
      return '무언가';
    });
    const { room } = await createCustomerWithRoom({ preferredLanguage: 'ja' });

    const row = await createMessageRow({
      chatRoomId: room.id,
      senderType: 'system',
      text: '운영자가 상담에 참여했습니다.',
      originalLanguage: 'ko'
    });

    await translateMessageInBackground(null, row.id);
    await settle();

    expect(called).toBe(false);
  });

  it('언어가 unknown 이면 고객 선호 언어를 기준으로 판단한다', async () => {
    setModelCaller(async () => '번역 결과');
    const { room, customer } = await createCustomerWithRoom({ preferredLanguage: 'ja' });

    const row = await createMessageRow({
      chatRoomId: room.id,
      senderType: 'customer',
      senderId: customer.id,
      text: 'OK 12345',
      originalLanguage: 'unknown'
    });

    await translateMessageInBackground(null, row.id);
    await settle();

    const updated = await prisma.message.findUniqueOrThrow({ where: { id: row.id } });
    // ja → ko 로 번역된다.
    expect(updated.translatedLanguage).toBe('ko');
  });

  it('이미 done/edited 인 메시지는 다시 번역하지 않는다', async () => {
    let called = false;
    setModelCaller(async () => {
      called = true;
      return '무언가';
    });
    const { room, customer } = await createCustomerWithRoom({ preferredLanguage: 'ja' });

    const row = await createMessageRow({
      chatRoomId: room.id,
      senderType: 'operator',
      senderId: customer.id,
      text: '방문 예정일을 알려주세요.',
      originalLanguage: 'ko',
      translatedText: 'ご訪問予定日を教えてください。',
      translatedLanguage: 'ja',
      translationStatus: 'edited'
    });

    await translateMessageInBackground(null, row.id);
    await settle();

    expect(called).toBe(false);
  });
});
