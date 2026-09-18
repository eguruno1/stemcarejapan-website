/**
 * 테스트 DB 스키마를 schema.prisma 와 맞춘다.
 *
 * `npm test` 직전에 pretest 로 자동 실행되므로, 스키마를 고친 뒤
 * 마이그레이션 명령을 잊어도 테스트가 옛 스키마로 돌지 않는다.
 *
 * 운영/개발 DB 가 아니라 TEST_DATABASE_URL 만 건드린다.
 */
const { execSync } = require('node:child_process');
const path = require('node:path');

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const { testDatabaseUrl } = require('./test-db-url.cjs');
const testUrl = testDatabaseUrl(process.env);

execSync('npx prisma db push --skip-generate', {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..'),
  env: { ...process.env, DATABASE_URL: testUrl }
});
