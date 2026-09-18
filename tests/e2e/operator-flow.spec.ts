import { expect, test } from '@playwright/test';
import { loginOperator, openRoomByCustomerName, sendOperatorReply, startCustomerChat, WEBSITE_URL } from './helpers';

test.describe.configure({ mode: 'serial' });

test('고객 상담 접수부터 종료까지 전 과정', async ({ browser }) => {
  const customerName = `E2E고객_${Date.now()}`;

  // --- 고객 창 ---
  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  await startCustomerChat(customerPage, {
    language: 'ja',
    name: customerName,
    message: '来月、母と2人で韓国に行きたいです。'
  });

  // 1) 고객 첫 문의가 보인다
  await expect(
    customerPage.locator('.consult-chat-msg', { hasText: '来月、母と2人で韓国に行きたいです。' })
  ).toBeVisible();

  // 2) AI 인사가 왔다 (고정 문구라 API 키 없이도 항상 온다)
  await expect(customerPage.locator('.consult-chat-msg[data-sender="ai"]').first()).toBeVisible({
    timeout: 15_000
  });

  // --- 운영자 창 ---
  const operatorPage = await loginOperator(browser);

  // 3) 신규 상담이 목록에 나타난다 (소켓으로 즉시)
  await expect(operatorPage.locator('a', { hasText: customerName })).toBeVisible({ timeout: 15_000 });

  // 4) 상담방에 들어간다
  await openRoomByCustomerName(operatorPage, customerName);
  await expect(
    operatorPage.getByTestId('chat-thread').getByText('来月、母と2人で韓国に行きたいです。')
  ).toBeVisible();

  // 5) 고객 정보 패널에 연락처가 보인다
  await expect(operatorPage.getByText('010-1234-5678', { exact: true })).toBeVisible();

  // 6) 배정한다
  await operatorPage.getByRole('button', { name: '내가 상담하기' }).click();
  await expect(operatorPage.getByText('진행 중', { exact: true }).first()).toBeVisible();

  // 7) 고객 화면에도 상태가 반영된다 (korea-travel 페이지 기본 언어는 일본어다)
  await expect(customerPage.locator('[data-role="status-label"]')).toContainText('担当者と相談中', {
    timeout: 15_000
  });

  // 8) 운영자가 한국어로 답변한다 (번역 미리보기 → 전송)
  await sendOperatorReply(
    operatorPage,
    '방문 예정일과 인원을 알려주시면 일정을 도와드리겠습니다.',
    '訪問予定日と人数を教えていただければ、日程のご案内をいたします。'
  );

  // 9) 고객 화면에 답변이 도착한다
  await expect(customerPage.locator('.consult-chat-msg[data-sender="operator"]')).toBeVisible({
    timeout: 20_000
  });

  // 10) 운영자가 메모를 남긴다
  await operatorPage.getByLabel('운영자 메모').fill('항공권 일정 확인 필요');
  await operatorPage.getByRole('button', { name: '메모 저장' }).click();
  await expect(operatorPage.getByText('항공권 일정 확인 필요')).toBeVisible();

  // 11) 상담을 종료한다
  await operatorPage.getByRole('button', { name: '상담 종료', exact: true }).click();
  await expect(operatorPage.getByText('완료', { exact: true }).first()).toBeVisible();

  // 12) 고객 화면 입력창이 잠긴다
  await expect(customerPage.locator('[data-role="status-label"]')).toContainText('相談終了', {
    timeout: 15_000
  });
  await expect(customerPage.locator('.consult-chat-composer textarea')).toBeDisabled();

  await customerContext.close();
  await operatorPage.context().close();
});

test('운영자 메모는 고객 화면에 절대 보이지 않는다', async ({ browser }) => {
  const customerName = `비밀메모_${Date.now()}`;
  const secretNote = `내부전용_${Date.now()}`;

  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  await startCustomerChat(customerPage, { name: customerName, language: 'ko', message: '문의합니다' });

  const operatorPage = await loginOperator(browser);
  await openRoomByCustomerName(operatorPage, customerName);
  await operatorPage.getByLabel('운영자 메모').fill(secretNote);
  await operatorPage.getByRole('button', { name: '메모 저장' }).click();
  await expect(operatorPage.getByText(secretNote)).toBeVisible();

  // 고객 화면을 새로고침해도 메모가 없어야 한다
  await customerPage.reload();
  await customerPage.locator('.consult-chat-toggle').click();
  await expect(customerPage.locator('.consult-chat-thread')).toBeVisible();
  await expect(customerPage.getByText(secretNote)).toHaveCount(0);

  await customerContext.close();
  await operatorPage.context().close();
});

test('로그인 없이 관리자 화면에 접근할 수 없다', async ({ page }) => {
  await page.goto('http://127.0.0.1:3101/chats');

  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

test('모바일 화면에서도 상담을 시작할 수 있다', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.addInitScript((api) => {
    (window as Window & { STEMCARE_CHAT_API_URL?: string }).STEMCARE_CHAT_API_URL = api;
  }, 'http://127.0.0.1:4001');

  await page.goto(`${WEBSITE_URL}/korea-travel/`);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await page.locator('.consult-chat-toggle').click();
  await expect(page.locator('.consult-chat-form')).toBeVisible();

  // 가로 스크롤이 생기면 안 된다
  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasHorizontalScroll).toBe(false);

  await context.close();
});
