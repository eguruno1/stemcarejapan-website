import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { test, API, ADMIN, ADMIN_URL } from './fixtures';
async function login(page: Page) {
  await page.goto(`${ADMIN_URL}/login`);
  await page.getByLabel('이메일').fill(ADMIN.email);
  await page.getByLabel('비밀번호').fill(ADMIN.password);
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(`${ADMIN_URL}/chats`);
}
async function newRoom(request: APIRequestContext) {
  const res = await request.post(`${API}/api/public/chat/start`, { data: {
    name: `E2E 관리화면 ${Date.now()}`, phone: '010-1234-5678', preferredLanguage: 'ja', serviceType: 'korea_travel', privacyAgreed: true, message: '처음 문의'
  } });
  expect(res.status()).toBe(201);
  return res.json() as Promise<{ roomId: string; visitorToken: string }>;
}
test('로그인 전에는 관리자 상담 화면으로 접근할 수 없다', async ({ page }) => {
  await page.goto(`${ADMIN_URL}/chats/no-access`);
  await expect(page).toHaveURL(`${ADMIN_URL}/login`);
  await expect(page.getByLabel('답변 입력')).toHaveCount(0);
});
test('로그인·배정·답변·메모·종료·설정·로그아웃 전체 흐름', async ({ page, request }) => {
  const session = await newRoom(request);
  await login(page);
  await page.goto(`${ADMIN_URL}/chats/${session.roomId}`);
  await expect(page.getByTestId('chat-thread').getByText('처음 문의', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '내가 상담하기' }).click();
  await expect(page.getByRole('button', { name: '진행 중으로' })).toHaveCount(0);
  await page.getByLabel('답변 입력').fill('관리자 화면에서 보낸 답변');
  await page.getByRole('button', { name: '전송', exact: true }).click();
  await expect(page.getByTestId('chat-thread').getByText('관리자 화면에서 보낸 답변', { exact: true })).toBeVisible();
  await page.getByLabel('운영자 메모').fill('고객에게 숨길 메모');
  await page.getByRole('button', { name: '메모 저장' }).click();
  await expect(page.getByText('고객에게 숨길 메모', { exact: true })).toBeVisible();
  const customer = await request.get(`${API}/api/public/chat/${session.roomId}`, { headers: { 'X-Visitor-Token': session.visitorToken } });
  const body = await customer.json();
  expect(JSON.stringify(body)).toContain('관리자 화면에서 보낸 답변');
  expect(JSON.stringify(body)).not.toContain('고객에게 숨길 메모');
  await page.reload();
  await expect(page.getByLabel('답변 입력')).toBeVisible();
  await page.getByRole('button', { name: '상담 종료', exact: true }).click();
  await expect(page.getByLabel('답변 입력')).toBeDisabled();
  await page.getByRole('link', { name: '설정', exact: true }).click();
  await expect(page.getByText(ADMIN.email, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page).toHaveURL(`${ADMIN_URL}/login`);
});
test('관리자가 과거를 읽을 때 새 메시지와 폴링이 위치를 바꾸지 않는다', async ({ page, request }) => {
  const session = await newRoom(request);
  for (let i = 0; i < 22; i++) {
    const res = await request.post(`${API}/api/public/chat/${session.roomId}/messages`, {
      headers: { 'X-Visitor-Token': session.visitorToken }, data: { text: `스크롤 메시지 ${i}\n상담 내용 두 번째 줄` }
    });
    expect(res.ok()).toBeTruthy();
  }
  await login(page); await page.goto(`${ADMIN_URL}/chats/${session.roomId}`);
  const thread = page.locator('[data-testid="chat-thread"]');
  await expect(thread).toBeVisible();
  await expect.poll(() => thread.evaluate(el => el.scrollHeight - el.scrollTop - el.clientHeight)).toBeLessThan(5);
  await thread.evaluate(el => { el.scrollTop = 120; });
  const before = await thread.evaluate(el => el.scrollTop);
  await request.post(`${API}/api/public/chat/${session.roomId}/messages`, {
    headers: { 'X-Visitor-Token': session.visitorToken }, data: { text: '새 도착 메시지' }
  });
  await expect(page.getByRole('button', { name: /새 메시지 1개/ })).toBeVisible();
  expect(await thread.evaluate(el => el.scrollTop)).toBe(before);
  await page.reload();
  await expect(page.locator('[data-testid="chat-thread"]')).toBeVisible();
  await expect.poll(() => page.locator('[data-testid="chat-thread"]').evaluate(el => el.scrollTop)).toBe(before);
});
