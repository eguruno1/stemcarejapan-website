import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db';
import { createCustomerWithRoom, createOperator } from './helpers/factories';
import { disconnectDatabase, resetDatabase } from './helpers/testDb';

describe('테스트 헬퍼', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('resetDatabase 는 모든 데이터를 지운다', async () => {
    await createOperator();
    await resetDatabase();

    expect(await prisma.operator.count()).toBe(0);
  });

  it('createCustomerWithRoom 은 고객과 상담방을 함께 만든다', async () => {
    const { customer, room, visitorToken } = await createCustomerWithRoom();

    expect(room.customerId).toBe(customer.id);
    expect(room.status).toBe('bot');
    // 원본 토큰은 DB에 저장되지 않아야 한다.
    expect(room.visitorTokenHash).not.toBe(visitorToken);
    expect(visitorToken).toHaveLength(64);
  });
});
