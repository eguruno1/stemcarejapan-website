import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // 테스트 간 DB 충돌을 막기 위해 한 번에 하나씩 실행한다.
    fileParallelism: false
  }
});
