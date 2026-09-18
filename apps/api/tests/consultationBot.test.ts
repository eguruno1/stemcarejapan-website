import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setModelCaller } from '../src/ai/aiClient';
import { generateBotReply, runBotTurn } from '../src/ai/consultationBot';
import { prisma } from '../src/db';
import { createMessageRow } from '../src/messages/messageService';
import { createCustomerWithRoom, createOperator } from './helpers/factories';
import { disconnectDatabase, resetDatabase } from './helpers/testDb';

beforeEach(async () => {
  await resetDatabase();
});

afterEach(() => {
  setModelCaller(null);
});

afterAll(async () => {
  await disconnectDatabase();
});

function botJson(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    replyText: 'お問い合わせありがとうございます。ご訪問予定の時期を教えていただけますか。',
    replyLanguage: 'ja',
    handoffRequired: false,
    handoffReason: null,
    collectedInfo: { visitPeriod: null, groupSize: null, interest: null },
    ...overrides
  });
}

describe('generateBotReply', () => {
  it('bot 상태에서 고객 메시지에 답변을 만든다', async () => {
    setModelCaller(async () => botJson());
    const { room, customer } = await createCustomerWithRoom({ status: 'bot', preferredLanguage: 'ja' });
    await createMessageRow({
      chatRoomId: room.id,
      senderType: 'customer',
      senderId: customer.id,
      text: '空港のお迎えはできますか。',
      originalLanguage: 'ja'
    });

    const decision = await generateBotReply({ roomId: room.id });

    expect(decision.kind).toBe('reply');
    if (decision.kind === 'reply') {
      expect(decision.language).toBe('ja');
      expect(decision.text).toContain('ありがとう');
    }
  });

  it('운영자가 상담 중이면 아무것도 하지 않는다', async () => {
    const caller = vi.fn();
    setModelCaller(caller);
    const { operator } = await createOperator();
    const { room, customer } = await createCustomerWithRoom({ status: 'active' });
    await prisma.chatRoom.update({
      where: { id: room.id },
      data: { assignedOperatorId: operator.id }
    });
    await createMessageRow({
      chatRoomId: room.id,
      senderType: 'customer',
      senderId: customer.id,
      text: '안녕하세요',
      originalLanguage: 'ko'
    });

    const decision = await generateBotReply({ roomId: room.id });

    expect(decision.kind).toBe('skip');
    expect(caller).not.toHaveBeenCalled();
  });

  it('가격 문의는 AI를 부르지 않고 곧바로 운영자 전환이다', async () => {
    const caller = vi.fn();
    setModelCaller(caller);
    const { room, customer } = await createCustomerWithRoom({ status: 'bot' });
    await createMessageRow({
      chatRoomId: room.id,
      senderType: 'customer',
      senderId: customer.id,
      text: '줄기세포 시술 비용이 얼마인가요?',
      originalLanguage: 'ko'
    });

    const decision = await generateBotReply({ roomId: room.id });

    expect(decision.kind).toBe('handoff');
    expect(caller).not.toHaveBeenCalled();
  });

  it('AI 가 handoffRequired 를 true 로 주면 전환한다', async () => {
    setModelCaller(async () => botJson({ handoffRequired: true, handoffReason: '복잡한 문의' }));
    const { room, customer } = await createCustomerWithRoom({ status: 'bot' });
    await createMessageRow({
      chatRoomId: room.id,
      senderType: 'customer',
      senderId: customer.id,
      text: '조금 복잡한 상황인데요',
      originalLanguage: 'ko'
    });

    const decision = await generateBotReply({ roomId: room.id });

    expect(decision.kind).toBe('handoff');
  });

  it('AI 응답이 JSON 이 아니면 안전하게 운영자로 넘긴다', async () => {
    setModelCaller(async () => '죄송합니다. 잘 모르겠어요.');
    const { room, customer } = await createCustomerWithRoom({ status: 'bot' });
    await createMessageRow({
      chatRoomId: room.id,
      senderType: 'customer',
      senderId: customer.id,
      text: '안내 부탁드립니다',
      originalLanguage: 'ko'
    });

    const decision = await generateBotReply({ roomId: room.id });

    expect(decision.kind).toBe('handoff');
  });

  it('AI 호출이 실패하면 운영자로 넘긴다', async () => {
    setModelCaller(async () => {
      throw new Error('서비스 장애');
    });
    const { room, customer } = await createCustomerWithRoom({ status: 'bot' });
    await createMessageRow({
      chatRoomId: room.id,
      senderType: 'customer',
      senderId: customer.id,
      text: '안내 부탁드립니다',
      originalLanguage: 'ko'
    });

    const decision = await generateBotReply({ roomId: room.id });

    expect(decision.kind).toBe('handoff');
  });

  it('마지막 메시지가 고객이 아니면 아무것도 하지 않는다', async () => {
    const caller = vi.fn();
    setModelCaller(caller);
    const { room } = await createCustomerWithRoom({ status: 'bot' });
    await createMessageRow({
      chatRoomId: room.id,
      senderType: 'ai',
      text: '무엇을 도와드릴까요?',
      originalLanguage: 'ko'
    });

    const decision = await generateBotReply({ roomId: room.id });

    expect(decision.kind).toBe('skip');
  });
});

describe('runBotTurn', () => {
  it('AI 답변이 메시지로 저장된다', async () => {
    setModelCaller(async () => botJson());
    const { room, customer } = await createCustomerWithRoom({ status: 'bot', preferredLanguage: 'ja' });
    await createMessageRow({
      chatRoomId: room.id,
      senderType: 'customer',
      senderId: customer.id,
      text: '空港のお迎えはできますか。',
      originalLanguage: 'ja'
    });

    await runBotTurn(null, room.id);

    const aiMessages = await prisma.message.findMany({
      where: { chatRoomId: room.id, senderType: 'ai' }
    });
    expect(aiMessages).toHaveLength(1);
    expect(aiMessages[0].visibleText).toContain('ありがとう');
  });

  it('전환 시 상태가 waiting 이 되고 안내 메시지가 남는다', async () => {
    setModelCaller(async () => botJson());
    const { room, customer } = await createCustomerWithRoom({ status: 'bot' });
    await createMessageRow({
      chatRoomId: room.id,
      senderType: 'customer',
      senderId: customer.id,
      text: '비용이 얼마인가요?',
      originalLanguage: 'ko'
    });

    await runBotTurn(null, room.id);

    const updated = await prisma.chatRoom.findUniqueOrThrow({ where: { id: room.id } });
    expect(updated.status).toBe('waiting');

    const systemMessages = await prisma.message.findMany({
      where: { chatRoomId: room.id, senderType: 'system' }
    });
    expect(systemMessages.length).toBeGreaterThan(0);
  });

  it('전환 시 상담 요약이 생성된다', async () => {
    // 첫 호출(요약)에만 응답하도록 만든다.
    setModelCaller(async ({ system }) =>
      system.includes('인계')
        ? JSON.stringify({
            summary: '일본 고객이 줄기세포 시술 비용을 문의함.',
            customerNeeds: '비용 안내',
            nextAction: '담당자가 비용 안내',
            riskFlags: ['가격문의']
          })
        : botJson()
    );

    const { room, customer } = await createCustomerWithRoom({ status: 'bot' });
    await createMessageRow({
      chatRoomId: room.id,
      senderType: 'customer',
      senderId: customer.id,
      text: '비용이 얼마인가요?',
      originalLanguage: 'ko'
    });

    await runBotTurn(null, room.id);

    const summary = await prisma.chatSummary.findFirst({ where: { chatRoomId: room.id } });
    expect(summary).not.toBeNull();
    expect(summary?.riskFlags).toContain('가격문의');
  });
});

it.each(['active', 'waiting', 'closed'])('AI 대기 중 %s로 바뀐 방에는 뒤늦게 끼어들지 않는다', async status => {
  const { updateRoomStatus } = await import('../src/chatRooms/chatRoomService');
  const { operator } = await createOperator();
  const { room, customer } = await createCustomerWithRoom();
  await createMessageRow({ chatRoomId: room.id, senderType: 'customer', senderId: customer.id, text: '안녕하세요' });
  let finish!: (value: string) => void;
  let started!: () => void;
  const startedPromise = new Promise<void>(r => { started = r; });
  setModelCaller(() => { started(); return new Promise(r => { finish = r; }); });
  const turn = runBotTurn(null, room.id);
  await startedPromise;
  await updateRoomStatus(room.id, status as 'active' | 'waiting' | 'closed', operator.id);
  finish(botJson({ handoffRequired: true }));
  await turn;
  expect((await prisma.chatRoom.findUniqueOrThrow({ where: { id: room.id } })).status).toBe(status);
  expect(await prisma.message.count({ where: { chatRoomId: room.id, senderType: 'ai' } })).toBe(0);
  expect(await prisma.message.count({ where: { chatRoomId: room.id, senderType: 'system' } })).toBe(status === 'closed' ? 1 : 0);
});

it('같은 고객 메시지의 동시 AI 턴은 답변을 한 번만 저장한다', async () => {
  const { room, customer } = await createCustomerWithRoom();
  await createMessageRow({ chatRoomId: room.id, senderType: 'customer', senderId: customer.id, text: '안녕하세요' });
  const caller = vi.fn(async () => botJson()); setModelCaller(caller);
  await Promise.all([runBotTurn(null, room.id), runBotTurn(null, room.id), runBotTurn(null, room.id)]);
  expect(caller).toHaveBeenCalledTimes(1);
  expect(await prisma.message.count({ where: { chatRoomId: room.id, senderType: 'ai' } })).toBe(1);
});
