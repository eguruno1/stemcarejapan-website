import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    // 여러 테스트 파일이 같은 DB를 동시에 지우면 서로 방해한다. 순차 실행한다.
    fileParallelism: false,
    testTimeout: 15000
  }
});
