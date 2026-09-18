/** 직접 vitest 실행도 동일하게 보호한다. URL 전체(자격 증명)는 오류에 출력하지 않는다. */
function testDatabaseUrl(env) {
  if (!env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL 이 필요합니다.');
  const test = new URL(env.TEST_DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(test.protocol) || !decodeURIComponent(test.pathname).endsWith('_test')) {
    throw new Error('테스트 DB 이름은 _test 로 끝나야 합니다.');
  }
  if (env.DATABASE_URL) {
    const dev = new URL(env.DATABASE_URL);
    const host = url => ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ? 'loopback' : url.hostname;
    if (host(test) === host(dev) && (test.port || '5432') === (dev.port || '5432') && decodeURIComponent(test.pathname) === decodeURIComponent(dev.pathname)) {
      throw new Error('테스트 DB 와 개발 DB 는 달라야 합니다.');
    }
  }
  return env.TEST_DATABASE_URL;
}
module.exports = { testDatabaseUrl };
