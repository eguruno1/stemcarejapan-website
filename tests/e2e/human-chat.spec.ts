import { expect, test } from '@playwright/test';
import { loginOperator, openRoomByCustomerName, startCustomerChat, ADMIN_URL } from './helpers';

test('고객 선택 1:1 상담은 AI·번역 없이 양방향 전달되고 새로고침 후에도 유지된다', async ({ browser }) => {
  const context = await browser.newContext();
  const customer = await context.newPage();
  const name = `직접상담_${Date.now()}`;
  await startCustomerChat(customer, { name, mode: 'human', language: 'ja', message: '担当者と直接相談したいです。' });
  await expect(customer.locator('[data-role="status-label"]')).toContainText('担当者の接続待ち');
  await expect(customer.locator('.consult-chat-msg[data-sender="ai"]')).toHaveCount(0);
  const operator = await loginOperator(browser);
  await openRoomByCustomerName(operator, name);
  await expect(operator.getByText('담당자 1:1 (AI 응답 없음)', { exact: true })).toBeVisible();
  await operator.getByRole('button', { name: '내가 상담하기' }).click();
  await operator.getByLabel('답변 입력').fill('こんにちは。担当者です。');
  await operator.getByRole('button', { name: '전송', exact: true }).click();
  await expect(customer.locator('.consult-chat-msg[data-sender="operator"]')).toContainText('こんにちは。担当者です。');
  await expect(operator.getByLabel('번역문 확인·수정')).toHaveCount(0);
  await customer.locator('.consult-chat-composer textarea').fill('明日お願いします。');
  await customer.locator('.consult-chat-composer button').click();
  await expect(operator.getByTestId('chat-thread')).toContainText('明日お願いします。');
  await operator.reload();
  await expect(operator.getByText('자동 번역 없이 원문으로 전송합니다.')).toBeVisible();
  await operator.goto(`${ADMIN_URL}/settings`);
  await expect(operator.getByLabel('번역 제공자')).toBeVisible();
  await operator.getByLabel('번역 제공자').selectOption('ollama');
  await operator.getByRole('button', { name: '설정 저장', exact: true }).click();
  try {
    await expect(operator.getByRole('status')).toContainText('저장했습니다');
    await operator.reload();
    await expect(operator.getByLabel('번역 제공자')).toHaveValue('ollama');
  } finally {
    await operator.getByLabel('번역 제공자').selectOption('external');
    await operator.getByRole('button', { name: '설정 저장', exact: true }).click();
    await expect(operator.getByRole('status')).toContainText('저장했습니다');
    await context.close(); await operator.context().close();
  }
});
