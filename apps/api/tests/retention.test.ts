import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db';
import { createMessageRow } from '../src/messages/messageService';
import {
  DELETE_MESSAGES_AFTER_DAYS,
  PSEUDONYMIZE_AFTER_DAYS,
  deleteOldMessages,
  pseudonymizeOldCustomers,
  runRetention
} from '../src/ops/retention';
import { createCustomerWithRoom } from './helpers/factories';
import { disconnectDatabase, resetDatabase } from './helpers/testDb';

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await disconnectDatabase();
});

describe('pseudonymizeOldCustomers', () => {
  it('보관 기간이 지난 종료 상담의 고객 정보를 비식별화한다', async () => {
    const { customer, room } = await createCustomerWithRoom({ name: '야마다 타로' });
    await prisma.chatRoom.update({
      where: { id: room.id },
      data: { status: 'closed', closedAt: daysAgo(PSEUDONYMIZE_AFTER_DAYS + 1) }
    });

    const count = await pseudonymizeOldCustomers();

    expect(count).toBe(1);
    const updated = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    expect(updated.name).not.toBe('야마다 타로');
    expect(updated.name).toMatch(/^고객_/);
    expect(updated.phone).toBe('[삭제됨]');
    expect(updated.email).toBeNull();
    expect(updated.pseudonymizedAt).not.toBeNull();
  });

  it('아직 기간이 안 된 상담은 건드리지 않는다', async () => {
    const { customer, room } = await createCustomerWithRoom({ name: '최근 고객' });
    await prisma.chatRoom.update({
      where: { id: room.id },
      data: { status: 'closed', closedAt: daysAgo(10) }
    });

    const count = await pseudonymizeOldCustomers();

    expect(count).toBe(0);
    const unchanged = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    expect(unchanged.name).toBe('최근 고객');
  });

  it('진행 중인 상담의 고객은 건드리지 않는다', async () => {
    const { customer, room } = await createCustomerWithRoom({ name: '진행 중 고객' });
    // 오래됐지만 아직 종료되지 않은 상담
    await prisma.chatRoom.update({
      where: { id: room.id },
      data: { status: 'active', createdAt: daysAgo(400) }
    });

    const count = await pseudonymizeOldCustomers();

    expect(count).toBe(0);
    const unchanged = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    expect(unchanged.name).toBe('진행 중 고객');
  });

  it('이미 비식별화된 고객은 다시 처리하지 않는다', async () => {
    const { customer, room } = await createCustomerWithRoom();
    await prisma.chatRoom.update({
      where: { id: room.id },
      data: { status: 'closed', closedAt: daysAgo(PSEUDONYMIZE_AFTER_DAYS + 1) }
    });

    await pseudonymizeOldCustomers();
    const secondRun = await pseudonymizeOldCustomers();

    expect(secondRun).toBe(0);
    void customer;
  });

  it('상담 건수 통계는 남는다 (행을 지우지 않는다)', async () => {
    const { room } = await createCustomerWithRoom();
    await prisma.chatRoom.update({
      where: { id: room.id },
      data: { status: 'closed', closedAt: daysAgo(PSEUDONYMIZE_AFTER_DAYS + 1) }
    });

    await pseudonymizeOldCustomers();

    expect(await prisma.customer.count()).toBe(1);
    expect(await prisma.chatRoom.count()).toBe(1);
  });
});

describe('deleteOldMessages', () => {
  it('보관 기간이 지난 상담의 메시지를 삭제한다', async () => {
    const { room, customer } = await createCustomerWithRoom();
    await createMessageRow({
      chatRoomId: room.id,
      senderType: 'customer',
      senderId: customer.id,
      text: '오래된 상담 내용',
      originalLanguage: 'ko'
    });
    await prisma.chatRoom.update({
      where: { id: room.id },
      data: { status: 'closed', closedAt: daysAgo(DELETE_MESSAGES_AFTER_DAYS + 1) }
    });

    const deleted = await deleteOldMessages();

    expect(deleted).toBe(1);
    expect(await prisma.message.count({ where: { chatRoomId: room.id } })).toBe(0);
    // 상담방 자체는 남는다.
    expect(await prisma.chatRoom.count()).toBe(1);
  });

  it('기간 내 상담의 메시지는 남긴다', async () => {
    const { room, customer } = await createCustomerWithRoom();
    await createMessageRow({
      chatRoomId: room.id,
      senderType: 'customer',
      senderId: customer.id,
      text: '최근 상담 내용',
      originalLanguage: 'ko'
    });
    await prisma.chatRoom.update({
      where: { id: room.id },
      data: { status: 'closed', closedAt: daysAgo(30) }
    });

    const deleted = await deleteOldMessages();

    expect(deleted).toBe(0);
    expect(await prisma.message.count()).toBe(1);
  });
});

describe('runRetention', () => {
  it('두 작업을 함께 실행하고 결과를 돌려준다', async () => {
    const old = await createCustomerWithRoom();
    await createMessageRow({
      chatRoomId: old.room.id,
      senderType: 'customer',
      senderId: old.customer.id,
      text: '아주 오래된 내용',
      originalLanguage: 'ko'
    });
    await prisma.chatRoom.update({
      where: { id: old.room.id },
      data: { status: 'closed', closedAt: daysAgo(DELETE_MESSAGES_AFTER_DAYS + 1) }
    });

    const result = await runRetention();

    expect(result.pseudonymized).toBe(1);
    expect(result.deleted).toBe(1);
  });
});
