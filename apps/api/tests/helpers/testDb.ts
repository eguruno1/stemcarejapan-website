import { prisma } from '../../src/db';

const TRUNCATE_SQL = `
  TRUNCATE TABLE
    "operator_notes",
    "chat_summaries",
    "messages",
    "chat_rooms",
    "customers",
    "operators"
  RESTART IDENTITY CASCADE;
`;

import { drainBackground } from '../../src/common/background';

/** 백그라운드 DB 쓰기가 완료된 후 초기화해 테스트 간 오염을 막는다. */
export async function resetDatabase(): Promise<void> {
  await drainBackground();
  await prisma.$executeRawUnsafe(TRUNCATE_SQL);
}
export async function disconnectDatabase(): Promise<void> {
  await drainBackground();
  await prisma.$disconnect();
}
