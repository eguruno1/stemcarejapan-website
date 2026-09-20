import path from 'node:path';
import type { Browser, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { ADMIN, ADMIN_URL, API } from './fixtures';

export { API, ADMIN_URL, ADMIN };
export const WEBSITE_URL = 'http://127.0.0.1:18081';

/**
 * 고객 브라우저 창을 열고 상담을 시작한다.
 *
 * `fixtures.ts` 의 `test.extend` 는 그 fixture 가 만들어 준 `page` 에만
 * STEMCARE_CHAT_API_URL 을 주입한다. operator-flow/scroll-quality 처럼
 * 고객·운영자 두 창을 동시에 열어야 하는 테스트는 `browser.newContext()`
 * 로 직접 만든 페이지를 쓰므로, 여기서 다시 한번 명시적으로 주입한다.
 */
export async function startCustomerChat(
  page: Page,
  options: { language?: 'ko' | 'ja'; message?: string; name?: string; mode?: 'assisted' | 'human' } = {}
): Promise<void> {
  await page.addInitScript((api) => {
    (window as Window & { STEMCARE_CHAT_API_URL?: string }).STEMCARE_CHAT_API_URL = api;
  }, API);

  await page.route('https://cdn.jsdelivr.net/npm/socket.io-client@*/dist/socket.io.min.js', route => route.fulfill({ path: path.resolve('node_modules/socket.io-client/dist/socket.io.min.js'), contentType: 'application/javascript' }));
  await page.goto(`${WEBSITE_URL}/korea-travel/`);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  const widget = page.locator('.consult-chat');
  await widget.locator('.consult-chat-toggle').click();
  await widget.locator('select[name="serviceType"]').selectOption('korea_travel');
  await widget.locator('select[name="consultationMode"]').selectOption(options.mode ?? 'assisted');
  await widget.locator('input[name="name"]').fill(options.name ?? 'E2E 고객');
  await widget.locator('input[name="phone"]').fill('010-1234-5678');
  await widget.locator('select[name="preferredLanguage"]').selectOption(options.language ?? 'ja');
  await widget.locator('textarea[name="message"]').fill(
    options.message ?? '来月、母と2人で韓国に行きたいです。'
  );
  await widget.locator('input[name="privacyAgreed"]').check();
  await widget.locator('.consult-chat-submit').click();

  await expect(widget.locator('.consult-chat-thread')).toBeVisible();
}

/** 운영자 브라우저 창을 열고 로그인한다. */
export async function loginOperator(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${ADMIN_URL}/login`);
  await page.getByLabel('이메일').fill(ADMIN.email);
  await page.getByLabel('비밀번호').fill(ADMIN.password);
  await page.getByRole('button', { name: '로그인', exact: true }).click();

  await expect(page).toHaveURL(`${ADMIN_URL}/chats`);
  return page;
}

/** 고객 이름으로 상담을 찾아 연다. */
export async function openRoomByCustomerName(page: Page, name: string): Promise<void> {
  await page.locator('a', { hasText: name }).first().click({ timeout: 15_000 });
  await expect(page.getByTestId('chat-thread')).toBeVisible({ timeout: 15_000 });
}

/**
 * 운영자가 답변을 쓰고 보낸다.
 *
 * 고객과 작성 언어가 다르면 ChatComposer 가 번역 미리보기를 먼저 연다 -
 * 이 저장소의 기본 .env 는 OPENAI_API_KEY 가 비어 있어 미리보기 자체가
 * 실패하지만(운영자가 직접 번역문을 채워 보낼 수 있게 빈 칸으로 열린다),
 * 실제 키가 있는 환경이면 자동 번역문이 채워진 채로 열린다. 두 경우 모두
 * 처리한다.
 *
 * `locator.isVisible()` 은 재시도 없이 그 순간의 상태만 즉시 반환한다 -
 * 미리보기 패널이 아직 열리기 전에 확인하면 항상 false 가 나와 전송이
 * 조용히 생략된다. `waitFor()` 로 실제로 나타날 때까지 기다려야 한다.
 */
export async function sendOperatorReply(
  page: Page,
  text: string,
  fallbackTranslation: string
): Promise<void> {
  await page.getByLabel('답변 입력').fill(text);
  await page.getByRole('button', { name: /번역 확인|전송/, exact: true }).click();

  const sendAsIs = page.getByRole('button', { name: '이대로 전송', exact: true });
  const appeared = await sendAsIs
    .waitFor({ state: 'visible', timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
  if (!appeared) return; // 같은 언어라 번역 없이 바로 전송된 경우

  const draftBox = page.getByLabel('번역문 확인·수정');
  if ((await draftBox.inputValue()) === '') {
    await draftBox.fill(fallbackTranslation);
  }
  await sendAsIs.click();
}
