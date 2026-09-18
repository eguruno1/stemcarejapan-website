import { test as base } from '@playwright/test';
export const API = 'http://127.0.0.1:4001';
export const ADMIN_URL = 'http://127.0.0.1:3101';
export const ADMIN = { email: 'e2e@stemcare.test', password: 'e2e-only-password' };
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(api => {
      (window as Window & { STEMCARE_CHAT_API_URL?: string }).STEMCARE_CHAT_API_URL = api;
    }, API);
    await use(page);
  }
});
