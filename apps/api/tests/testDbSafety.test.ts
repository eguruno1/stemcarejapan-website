import { expect, it } from 'vitest';
const { testDatabaseUrl } = require('../scripts/test-db-url.cjs');
it('누락되거나 테스트용이 아닌 DB는 거부한다', () => {
  expect(() => testDatabaseUrl({})).toThrow();
  expect(() => testDatabaseUrl({ TEST_DATABASE_URL: 'postgresql://localhost/app' })).toThrow();
});
it('계정·쿼리·루프백 표기가 달라도 동일 DB는 거부한다', () => {
  expect(() => testDatabaseUrl({ DATABASE_URL: 'postgresql://a@localhost:5432/app_test', TEST_DATABASE_URL: 'postgres://b@127.0.0.1/app_test?schema=public' })).toThrow();
});
it('별도 테스트 DB를 허용한다', () => {
  expect(testDatabaseUrl({ DATABASE_URL: 'postgresql://localhost/app', TEST_DATABASE_URL: 'postgresql://localhost/app_test' })).toBe('postgresql://localhost/app_test');
});
