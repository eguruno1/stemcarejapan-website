import path from 'node:path';
import { test as base } from '@playwright/test';
export const API = 'http://127.0.0.1:14001';
export const ADMIN_URL = 'http://127.0.0.1:13101';
export const ADMIN = { email: 'e2e@stemcare.test', password: 'e2e-only-password' };
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(api => {
      (window as Window & { STEMCARE_CHAT_API_URL?: string }).STEMCARE_CHAT_API_URL = api;
    }, API);
    await page.route('https://cdn.jsdelivr.net/npm/socket.io-client@*/dist/socket.io.min.js', route => route.fulfill({ path: path.resolve('node_modules/socket.io-client/dist/socket.io.min.js'), contentType: 'application/javascript' }));
    await use(page);
  }
});
