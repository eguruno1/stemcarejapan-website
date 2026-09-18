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

/**
 * 매 테스트 전에 모든 테이블을 비운다.
 * TRUNCATE ... CASCADE 는 외래키로 연결된 행까지 한 번에 지운다.
 * RESTART IDENTITY 는 자동증가 값을 초기화한다.
 *
 * Phase 5 부터 고객 메시지마다 번역/AI 상담 봇이 백그라운드로 DB 를 쓴다
 * (void 로 호출하고 기다리지 않는다 - 응답 지연을 만들지 않기 위해서다).
 * 그 배경 작업이 직전 테스트가 끝난 뒤에도 잠깐 살아있을 수 있어서, 이
 * TRUNCATE 와 그 작업의 UPDATE 가 Postgres 데드락(40P01)으로 만나는 경우가
 * 드물게 있다. 원인이 되는 배경 작업 자체는 실제 운영 트래픽에서도 늘
 * 일어나는 정상적인 경합이라 프로덕션 코드를 고칠 문제가 아니다 - 여기서만
 * 한 번 재시도한다.
 */
export async function resetDatabase(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(TRUNCATE_SQL);
  } catch (err) {
    const isDeadlock = err instanceof Error && /40P01/.test(err.message);
    if (!isDeadlock) throw err;
    await new Promise((resolve) => setTimeout(resolve, 50));
    await prisma.$executeRawUnsafe(TRUNCATE_SQL);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
