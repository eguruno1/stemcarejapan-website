import { expect } from '@playwright/test';
import { test, ADMIN, ADMIN_URL } from './fixtures';

test('customer guide language, accessible FAQ and repeated open action', async ({ page }) => {
  const response = await page.goto('/guide/');
  expect(response?.status()).toBe(200);
  const faq = page.locator('[data-lang-block="ko"] .faq-question').first();
  await expect(faq).toHaveAttribute('aria-expanded', 'false');
  await faq.click();
  await expect(faq).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator(`#${await faq.getAttribute('aria-controls')}`)).toBeVisible();
  await page.locator('[data-set-lang="ja"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.locator('[data-set-lang="ja"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveTitle('相談チャット利用ガイド | StemCareJapan');
  await page.locator('#guide-start-btn-ja').click();
  await expect(page.locator('.consult-chat-toggle')).toHaveAttribute('aria-expanded', 'true');
  // Invoke the page action again even when the floating panel overlaps the CTA.
  await page.locator('#guide-start-btn-ja').evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.locator('.consult-chat-toggle')).toHaveAttribute('aria-expanded', 'true');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await page.setViewportSize({ width: 375, height: 812 });
  const japaneseFaq = page.locator('[data-lang-block="ja"] .faq-question').nth(2);
  await japaneseFaq.click();
  const answer = page.locator(`#${await japaneseFaq.getAttribute('aria-controls')}`);
  expect(await answer.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/scj-guide-mobile.png', fullPage: true });
});

test('operator guide requires login and renders navigation after authentication', async ({ page }) => {
  await page.goto(`${ADMIN_URL}/guide`);
  await expect(page).toHaveURL(`${ADMIN_URL}/login`);
  await page.getByLabel('이메일').fill(ADMIN.email);
  await page.getByLabel('비밀번호').fill(ADMIN.password);
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(`${ADMIN_URL}/chats`);
  await page.goto(`${ADMIN_URL}/guide`);
  await expect(page.getByRole('heading', { name: '상담 관리자 이용 가이드' })).toBeVisible();
  await page.getByRole('link', { name: '9. 운영 현황 대시보드' }).click();
  await expect(page).toHaveURL(`${ADMIN_URL}/guide#ops`);
  await expect(page.getByRole('heading', { name: '9. 운영 현황 대시보드' })).toBeVisible();
});
