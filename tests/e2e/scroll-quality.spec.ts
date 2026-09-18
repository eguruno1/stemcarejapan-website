import { expect, test } from '@playwright/test';
import { loginOperator, openRoomByCustomerName, sendOperatorReply, startCustomerChat } from './helpers';

test.describe.configure({ mode: 'serial' });

test('고객: 예전 메시지를 읽는 중에는 화면이 움직이지 않는다', async ({ browser }) => {
  const customerName = `스크롤고객_${Date.now()}`;

  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  await startCustomerChat(customerPage, { name: customerName, language: 'ko', message: '시작' });

  const widget = customerPage.locator('.consult-chat');
  const thread = widget.locator('.consult-chat-thread');

  // 메시지를 충분히 쌓는다
  for (let i = 0; i < 15; i += 1) {
    await widget.locator('.consult-chat-composer textarea').fill(`고객 메시지 ${i}`);
    await widget.locator('.consult-chat-composer button').click();
    await expect(widget.locator('.consult-chat-msg[data-state]')).toHaveCount(0);
  }

  // 맨 위로 올린다
  await thread.evaluate((el) => {
    el.scrollTop = 0;
  });
  const before = await thread.evaluate((el) => el.scrollTop);

  // 운영자가 새 메시지를 보낸다
  const operatorPage = await loginOperator(browser);
  await openRoomByCustomerName(operatorPage, customerName);
  await operatorPage.getByRole('button', { name: '내가 상담하기' }).click();
  await sendOperatorReply(operatorPage, '운영자가 보낸 새 메시지', '운영자가 보낸 새 메시지');

  // 새 메시지 버튼이 뜨고, 스크롤 위치는 그대로여야 한다
  await expect(widget.locator('[data-role="newmsg"]')).toBeVisible({ timeout: 20_000 });
  const after = await thread.evaluate((el) => el.scrollTop);
  expect(after).toBe(before);

  // 버튼을 누르면 맨 아래로 간다
  await widget.locator('[data-role="newmsg"]').click();
  await expect(widget.locator('[data-role="newmsg"]')).toBeHidden();
  await expect
    .poll(async () => thread.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight))
    .toBeLessThan(20);

  await customerContext.close();
  await operatorPage.context().close();
});

test('운영자: 번역문이 늦게 붙어 말풍선 높이가 바뀌어도 위치가 유지된다', async ({ browser }) => {
  const customerName = `번역스크롤_${Date.now()}`;

  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  await startCustomerChat(customerPage, { name: customerName, language: 'ja', message: 'はじめまして' });

  const widget = customerPage.locator('.consult-chat');
  const operatorPage = await loginOperator(browser);
  await openRoomByCustomerName(operatorPage, customerName);

  // 메시지를 쌓는다 (일본어 원문 + 한국어 번역이 운영자 화면 말풍선 높이를 늘린다)
  for (let i = 0; i < 12; i += 1) {
    await widget.locator('.consult-chat-composer textarea').fill(`メッセージ ${i}`);
    await widget.locator('.consult-chat-composer button').click();
    await customerPage.waitForTimeout(200);
  }

  // 운영자 화면에서 위로 올린다
  const thread = operatorPage.getByTestId('chat-thread');
  await operatorPage.waitForTimeout(1500);
  await thread.evaluate((el) => {
    el.scrollTop = 0;
  });
  const before = await thread.evaluate((el) => el.scrollTop);

  // 번역이 붙을 시간을 준다 (성공하든 실패로 끝나든, translationStatus 가 갱신되며
  // 힌트 문구가 붙어 말풍선 높이가 바뀐다)
  await operatorPage.waitForTimeout(6000);
  const after = await thread.evaluate((el) => el.scrollTop);

  // 위치가 크게 흔들리지 않아야 한다 (5px 이내 오차 허용)
  expect(Math.abs(after - before)).toBeLessThanOrEqual(5);

  await customerContext.close();
  await operatorPage.context().close();
});

test('운영자: 처음 여는 상담방은 최신에서 시작하고 다시 여는 상담방은 읽던 위치를 복원한다', async ({ browser }) => {
  const nameA = `방A_${Date.now()}`;
  const nameB = `방B_${Date.now()}`;

  for (const name of [nameA, nameB]) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await startCustomerChat(page, { name, language: 'ko', message: '안녕하세요' });
    const widget = page.locator('.consult-chat');
    for (let i = 0; i < 12; i += 1) {
      await widget.locator('.consult-chat-composer textarea').fill(`${name} 메시지 ${i}`);
      await widget.locator('.consult-chat-composer button').click();
      await page.waitForTimeout(150);
    }
    await ctx.close();
  }

  const operatorPage = await loginOperator(browser);
  await openRoomByCustomerName(operatorPage, nameA);
  await operatorPage.waitForTimeout(1200);

  const thread = operatorPage.getByTestId('chat-thread');
  await thread.evaluate((el) => {
    el.scrollTop = 120;
  });
  const savedTop = await thread.evaluate((el) => el.scrollTop);

  await openRoomByCustomerName(operatorPage, nameB);
  await operatorPage.waitForTimeout(1200);

  const firstOpenAtBottom = await thread.evaluate(
    (el) => el.scrollHeight - el.scrollTop - el.clientHeight < 30
  );
  expect(firstOpenAtBottom).toBe(true);

  await openRoomByCustomerName(operatorPage, nameA);
  await operatorPage.waitForTimeout(1200);

  const restoredTop = await thread.evaluate((el) => el.scrollTop);
  expect(Math.abs(restoredTop - savedTop)).toBeLessThanOrEqual(5);

  await operatorPage.context().close();
});
