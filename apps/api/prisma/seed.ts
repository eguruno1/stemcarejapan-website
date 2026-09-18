import * as path from 'node:path';
import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@stemcarejapan.local';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'change-me-1234';

  const operator = await prisma.operator.upsert({
    where: { email },
    update: {},
    create: {
      name: '초기 관리자',
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: 'admin',
      isActive: true
    }
  });

  console.log(`[seed] 관리자 계정 준비 완료: ${operator.email}`);
  console.log('[seed] 최초 로그인 후 반드시 비밀번호를 변경하세요.');
}

main()
  .catch((err) => {
    console.error('[seed] 실패', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
