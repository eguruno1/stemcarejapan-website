import { prisma } from '../../src/db';

/**
 * 매 테스트 전에 모든 테이블을 비운다.
 * TRUNCATE ... CASCADE 는 외래키로 연결된 행까지 한 번에 지운다.
 * RESTART IDENTITY 는 자동증가 값을 초기화한다.
 */
export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "operator_notes",
      "chat_summaries",
      "messages",
      "chat_rooms",
      "customers",
      "operators"
    RESTART IDENTITY CASCADE;
  `);
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
