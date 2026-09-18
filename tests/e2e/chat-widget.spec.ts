import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { test, API, ADMIN } from './fixtures';


/**
 * korea-travel 페이지에는 페이지 자체의 상담 폼이 따로 있고,
 * 거기에도 input[name="name"] / textarea[name="message"] 가 있다.
 * 그래서 위젯 안쪽으로 범위를 좁히지 않으면 엉뚱한 칸을 채우게 된다.
 */
function widget(page: Page) {
  return page.locator('.consult-chat');
}

/** 이전 테스트가 남긴 상담 세션을 지우고 새로 연다. */
async function freshPage(page: Page, path: string) {
  await page.goto(path);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
}

async function openWidget(page: Page, path = '/korea-travel/') {
  await freshPage(page, path);
  await widget(page).locator('.consult-chat-toggle').click();
  await expect(widget(page)).toHaveClass(/open/);
}

async function fillStartForm(page: Page, overrides: { privacy?: boolean } = {}) {
  const w = widget(page);
  await w.locator('select[name="serviceType"]').selectOption('korea_travel');
  await w.locator('input[name="name"]').fill('E2E 顧客');
  await w.locator('input[name="phone"]').fill('+81 90-1234-5678');
  await w.locator('textarea[name="message"]').fill('来月、母と2人で韓国に行きたいです。');
  if (overrides.privacy !== false) {
    await w.locator('input[name="privacyAgreed"]').check();
  }
}

async function startChat(page: Page) {
  await fillStartForm(page);
  await widget(page).locator('.consult-chat-submit').click();
  await expect(widget(page).locator('.consult-chat-thread')).toBeVisible();
}

/** 브라우저가 저장해둔 상담방 id. 운영자 역할로 답장할 때 쓴다. */
async function currentRoomId(page: Page): Promise<string> {
  const raw = await page.evaluate(() => window.localStorage.getItem('scj-chat-session'));
  expect(raw).not.toBeNull();
  return JSON.parse(raw as string).roomId as string;
}

async function operatorReply(request: APIRequestContext, roomId: string, text: string) {
  const login = await request.post(`${API}/api/admin/auth/login`, { data: ADMIN });
  expect(login.ok(), '운영자 로그인 실패 - npm run db:seed -w apps/api 를 실행했는가?').toBeTruthy();

  const sent = await request.post(`${API}/api/admin/chat-rooms/${roomId}/messages`, {
    data: { originalText: text, originalLanguage: 'ja' }
  });
  expect(sent.ok()).toBeTruthy();
}

test.describe('고객 채팅 위젯', () => {
  test('상담 버튼을 누르면 위젯이 열린다', async ({ page }) => {
    await openWidget(page);

    await expect(widget(page).locator('.consult-chat-form')).toBeVisible();
    await expect(widget(page).locator('input[name="name"]')).toBeVisible();
  });

  test('개인정보 동의 없이는 상담이 시작되지 않는다', async ({ page }) => {
    const calls: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/public/chat')) calls.push(r.url());
    });

    await openWidget(page);
    await fillStartForm(page, { privacy: false });
    await widget(page).locator('.consult-chat-submit').click();

    await expect(widget(page).locator('.consult-chat-status')).toContainText('同意');
    // 채팅 화면으로 넘어가지 않았고, 서버를 부르지도 않았다.
    await expect(widget(page).locator('.consult-chat-thread')).toBeHidden();
    expect(calls).toEqual([]);
  });

  test('이름과 연락처가 없으면 오류가 표시된다', async ({ page }) => {
    await openWidget(page);
    const w = widget(page);
    await w.locator('select[name="serviceType"]').selectOption('korea_travel');
    await w.locator('input[name="privacyAgreed"]').check();

    await w.locator('.consult-chat-submit').click();

    await expect(w.locator('.consult-chat-status')).toContainText('お名前');
  });

  test('상담 분야를 고르지 않으면 오류가 표시된다', async ({ page }) => {
    await openWidget(page, '/');
    const w = widget(page);
    await w.locator('input[name="name"]').fill('홍길동');
    await w.locator('input[name="phone"]').fill('010-1234-5678');
    await w.locator('input[name="privacyAgreed"]').check();

    await w.locator('.consult-chat-submit').click();

    await expect(w.locator('.consult-chat-status')).toContainText('상담 분야');
  });

  test('상담을 시작하면 첫 문의가 말풍선으로 보인다', async ({ page }) => {
    await openWidget(page);
    await startChat(page);

    await expect(widget(page).locator('.consult-chat-msg[data-sender="customer"]')).toContainText(
      '来月、母と2人で韓国に行きたいです。'
    );
    await expect(widget(page).locator('[data-role="status-label"]')).toContainText('AI相談中');
  });

  test('메시지를 보내면 화면에 즉시 나타난다', async ({ page }) => {
    await openWidget(page);
    await startChat(page);

    const w = widget(page);
    await w.locator('.consult-chat-composer textarea').fill('ホテルの予約もお願いできますか。');
    await w.locator('.consult-chat-composer button').click();

    await expect(
      w.locator('.consult-chat-msg', { hasText: 'ホテルの予約もお願いできますか。' })
    ).toBeVisible();

    // 서버 확정 후에도 두 개로 늘지 않는다. (clientMessageId 로 합쳐진다)
    await expect(w.locator('.consult-chat-msg[data-state]')).toHaveCount(0);
    await expect(
      w.locator('.consult-chat-msg', { hasText: 'ホテルの予約もお願いできますか。' })
    ).toHaveCount(1);
  });

  test('새로고침해도 대화가 유지된다', async ({ page }) => {
    await openWidget(page);
    await startChat(page);

    await page.reload();
    await widget(page).locator('.consult-chat-toggle').click();

    await expect(widget(page).locator('.consult-chat-thread')).toBeVisible();
    await expect(widget(page).locator('.consult-chat-msg[data-sender="customer"]')).toContainText(
      '来月、母と2人で韓国に行きたいです。'
    );
  });

  test('운영자 답변이 폴링으로 들어온다', async ({ page, request }) => {
    await openWidget(page);
    await startChat(page);

    const roomId = await currentRoomId(page);
    await operatorReply(request, roomId, 'こんにちは、担当者です。');

    await expect(
      widget(page).locator('.consult-chat-msg[data-sender="operator"]')
    ).toContainText('こんにちは、担当者です。', { timeout: 10_000 });
  });

  test('서버 오류가 나면 안내 문구를 보여준다', async ({ page }) => {
    // 상담 시작 요청만 500 으로 가로챈다.
    await page.route(`${API}/api/public/chat/start`, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: '서버 오류' } })
      })
    );

    await openWidget(page);
    await fillStartForm(page);
    await widget(page).locator('.consult-chat-submit').click();

    await expect(widget(page).locator('.consult-chat-status')).toContainText('問題が発生しました');
  });

  test('전송에 실패하면 재시도 버튼이 나오고, 다시 시도하면 전송된다', async ({ page }) => {
    await openWidget(page);
    await startChat(page);

    // 이제부터 메시지 전송만 실패시킨다.
    await page.route('**/api/public/chat/*/messages', (route) => route.abort());

    const w = widget(page);
    await w.locator('.consult-chat-composer textarea').fill('失敗するメッセージ');
    await w.locator('.consult-chat-composer button').click();

    await expect(w.locator('.consult-chat-msg[data-state="failed"]')).toBeVisible();
    await expect(w.locator('[data-role="retry"]')).toBeVisible();

    await page.unroute('**/api/public/chat/*/messages');
    await w.locator('[data-role="retry"]').click();

    await expect(w.locator('.consult-chat-msg[data-state]')).toHaveCount(0);
    await expect(w.locator('.consult-chat-msg', { hasText: '失敗するメッセージ' })).toHaveCount(1);
  });

  test('예전 메시지를 읽는 중에는 화면이 아래로 튀지 않는다', async ({ page, request }) => {
    await openWidget(page);
    await startChat(page);

    const w = widget(page);
    const thread = w.locator('.consult-chat-thread');

    // 스크롤이 생길 만큼 메시지를 쌓는다.
    // hasText 는 부분 일치라 "메시지 1" 이 "메시지 11" 에도 걸린다.
    // 그래서 본문 대신 "보류 중인 말풍선이 없다" 로 전송 완료를 기다린다.
    for (let i = 0; i < 12; i += 1) {
      await w.locator('.consult-chat-composer textarea').fill(`メッセージ ${i}`);
      await w.locator('.consult-chat-composer button').click();
      await expect(w.locator('.consult-chat-msg[data-state]')).toHaveCount(0);
    }
    await expect(w.locator('.consult-chat-msg')).toHaveCount(13);
    await expect
      .poll(async () => thread.evaluate((el) => el.scrollHeight - el.clientHeight))
      .toBeGreaterThan(100);

    // 맨 위로 올려서 예전 메시지를 읽는 상황을 만든다.
    await thread.evaluate((el) => {
      el.scrollTop = 0;
    });
    const before = await thread.evaluate((el) => el.scrollTop);
    // 직접 보내거나 패널을 다시 열 때도 읽던 위치를 강제로 내리지 않는다.
    await w.locator('.consult-chat-composer textarea').fill('過去を読みながら送信');
    await w.locator('.consult-chat-composer button').click();
    await expect(w.locator('.consult-chat-msg[data-state]')).toHaveCount(0);
    expect(await thread.evaluate((el) => el.scrollTop)).toBe(before);
    await w.locator('.consult-chat-close').click();
    await w.locator('.consult-chat-toggle').click();
    expect(await thread.evaluate((el) => el.scrollTop)).toBe(before);


    const roomId = await currentRoomId(page);
    await operatorReply(request, roomId, 'スクロール確認用の新着メッセージです。');

    // 새 메시지는 들어오되, 보고 있던 위치는 그대로여야 한다.
    await expect(w.locator('[data-role="newmsg"]')).toBeVisible({ timeout: 10_000 });
    expect(await thread.evaluate((el) => el.scrollTop)).toBe(before);

    // 버튼을 누르면 맨 아래로 내려가고 버튼이 사라진다.
    await w.locator('[data-role="newmsg"]').click();
    await expect(w.locator('[data-role="newmsg"]')).toBeHidden();
    await expect
      .poll(async () => thread.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight))
      .toBeLessThan(5);
  });

  test('상담이 종료되면 입력창이 잠긴다', async ({ page, request }) => {
    await openWidget(page);
    await startChat(page);

    const roomId = await currentRoomId(page);
    const login = await request.post(`${API}/api/admin/auth/login`, { data: ADMIN });
    expect(login.ok()).toBeTruthy();
    const closed = await request.patch(`${API}/api/admin/chat-rooms/${roomId}/status`, {
      data: { status: 'closed' }
    });
    expect(closed.ok()).toBeTruthy();

    const w = widget(page);
    await expect(w.locator('[data-role="status-label"]')).toContainText('相談終了', {
      timeout: 10_000
    });
    await expect(w.locator('.consult-chat-composer textarea')).toBeDisabled();
    await expect(w.locator('[data-role="handoff"]')).toBeHidden();
  });

  test('페이지 언어를 바꾸면 위젯도 같은 언어로 바뀐다', async ({ page }) => {
    await openWidget(page);
    const w = widget(page);

    await expect(w.locator('[data-role="new-chat"]')).toHaveText('新しい相談を開始');

    await page.locator('[data-language="ko"]').click();
    await expect(w.locator('[data-role="new-chat"]')).toHaveText('새 상담 시작');
    await expect(w.locator('.consult-chat-head h2')).toHaveText('상담을 도와드릴게요');

    await page.locator('[data-language="ja"]').click();
    await expect(w.locator('[data-role="new-chat"]')).toHaveText('新しい相談を開始');
  });

  test('세 페이지 모두에서 상담 폼이 열린다', async ({ page }) => {
    for (const path of ['/', '/stemcell/', '/korea-travel/']) {
      await openWidget(page, path);
      await expect(widget(page).locator('select[name="serviceType"]')).toBeVisible();
      await expect(widget(page).locator('.consult-chat-submit')).toBeVisible();
    }
  });

  test('페이지에 맞는 상담 분야가 미리 선택된다', async ({ page }) => {
    await openWidget(page, '/stemcell/');
    await expect(widget(page).locator('select[name="serviceType"]')).toHaveValue('stemcell');

    await openWidget(page, '/korea-travel/');
    await expect(widget(page).locator('select[name="serviceType"]')).toHaveValue('korea_travel');

    await openWidget(page, '/');
    await expect(widget(page).locator('select[name="serviceType"]')).toHaveValue('');
  });
});
