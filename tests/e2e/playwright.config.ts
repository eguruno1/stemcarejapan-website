import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
const cwd = path.resolve(__dirname, '../..');
export default defineConfig({
  testDir: '.', timeout: 30_000, expect: { timeout: 8_000 },
  workers: 1, fullyParallel: false, reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:8081', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [
    { cwd, command: 'python3 scripts/build_static.py && python3 -m http.server 8081 --bind 127.0.0.1 --directory dist', url: 'http://127.0.0.1:8081', reuseExistingServer: false },
    { cwd, command: 'node tests/e2e/start-api.cjs', url: 'http://127.0.0.1:4001/health', reuseExistingServer: false },
    { cwd, command: 'npm exec -w apps/admin -- next dev -p 3101', url: 'http://127.0.0.1:3101/login', reuseExistingServer: false,
      env: { SCJ_E2E: '1', NEXT_PUBLIC_API_URL: 'http://127.0.0.1:4001' }, timeout: 120_000 }
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
