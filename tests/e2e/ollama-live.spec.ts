import { expect, test } from '@playwright/test';
import { API, ADMIN_URL, loginOperator, openRoomByCustomerName, startCustomerChat } from './helpers';

test('실제 Ollama: 1:1 고객 일본어→한국어, 운영자 한국어→일본어 수정 후 전송', async ({ browser }) => {
  test.skip(process.env.SCJ_LIVE_OLLAMA !== '1', '로컬 Ollama를 사용하는 명시적 라이브 검증');
  test.setTimeout(180_000);
  const operator = await loginOperator(browser);
  const settingsUrl = `${API}/api/admin/settings/chat`;
  const initial = (await (await operator.request.get(settingsUrl)).json()).settings;
  const customerContext = await browser.newContext();
  const customer = await customerContext.newPage();
  try {
    await operator.goto(`${ADMIN_URL}/settings`);
    await operator.getByLabel('번역 제공자').selectOption('ollama');
    await operator.getByRole('button', { name: '설정 저장', exact: true }).click();
    await expect(operator.getByRole('status')).toContainText('저장했습니다');
    const name = `상호번역검증_${Date.now()}`;
    await startCustomerChat(customer, { mode: 'human', language: 'ja', name, message: '明日の午後3時に2名で相談したいです。' });
    await operator.goto(`${ADMIN_URL}/chats`);
    await openRoomByCustomerName(operator, name);
    await operator.getByRole('button', { name: '내가 상담하기' }).click();
    await operator.getByLabel('이 상담 상호 번역 사용').check();
    await expect(operator.getByTestId('message-translation').first()).toContainText(/[가-힣]/, { timeout: 125_000 });
    await operator.getByLabel('답변 입력').fill('상담은 내일 오후 3시이며 인원은 2명입니다.');
    await operator.getByRole('button', { name: '번역 확인', exact: true }).click();
    const translation = operator.getByLabel('번역문 확인·수정');
    await expect(translation).not.toHaveValue('', { timeout: 125_000 });
    await expect(translation).toHaveValue(/[ぁ-んァ-ヶ一-龯]/);
    await translation.fill('明日の午後3時に2名様のご相談を承ります。');
    await operator.getByRole('button', { name: '이대로 전송', exact: true }).click();
    await expect(customer.locator('.consult-chat-msg[data-sender="operator"]')).toContainText('明日の午後3時に2名様のご相談を承ります。');
    await expect(customer.locator('.consult-chat-msg[data-sender="ai"]')).toHaveCount(0);
    await operator.getByLabel('대화 표시').selectOption('original');
    await expect(operator.getByTestId('message-translation')).toHaveCount(0);
    await operator.getByLabel('대화 표시').selectOption('both');
    await expect(operator.getByTestId('message-translation')).toHaveCount(2);
    await operator.screenshot({ path: '/tmp/scj-mutual-translation.png', fullPage: true });
  } finally {
    const current = (await (await operator.request.get(settingsUrl)).json()).settings;
    await operator.request.put(settingsUrl, { data: { ...initial, revision: current.revision } });
    await customerContext.close(); await operator.context().close();
  }
});
