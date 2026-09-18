import { defineConfig, devices } from '@playwright/test';

/**
 * 이 테스트는 실행 전에 세 가지가 떠 있어야 한다.
 *   docker compose up -d web postgres
 *   npm run dev:api
 * 정적 사이트라 빌드가 없으므로 webServer 설정 없이 이미 뜬 서버에 붙는다.
 */
export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  // 같은 DB를 쓰므로 한 번에 하나씩 실행한다.
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
