// E2E도 업무 DB에 고객·운영자를 만들지 않도록 같은 URL 검증을 적용한다.
const path = require('node:path');
const { execFileSync } = require('node:child_process');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { testDatabaseUrl } = require('../../apps/api/scripts/test-db-url.cjs');
process.env.DATABASE_URL = testDatabaseUrl(process.env);
process.env.NODE_ENV = 'test';
process.env.API_PORT = '4001';
process.env.WEBSITE_ORIGIN = 'http://127.0.0.1:8081';
process.env.ADMIN_ORIGIN = 'http://127.0.0.1:3101';
execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--skip-generate'], {
  cwd: path.resolve(__dirname, '../../apps/api'), stdio: 'inherit', env: process.env
});
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
async function start() {
  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash('e2e-only-password', 10);
    await prisma.operator.upsert({ where: { email: 'e2e@stemcare.test' },
      create: { email: 'e2e@stemcare.test', name: 'E2E 운영자', passwordHash, role: 'operator' },
      update: { passwordHash, isActive: true } });
  } finally { await prisma.$disconnect(); }
  require('../../apps/api/dist/server.js');
}
start().catch(error => { console.error(error); process.exit(1); });
