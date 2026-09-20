import request from 'supertest';
import { beforeEach, afterEach, afterAll, it, expect, vi } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/db';
import { config } from '../src/config';
import { signOperatorToken } from '../src/auth/token';
import { createOperator } from './helpers/factories';
import { resetDatabase, disconnectDatabase } from './helpers/testDb';
import { getChatSettings, saveChatSettings, DEFAULT_CHAT_SETTINGS } from '../src/settings/chatSettings';
import { setModelCaller } from '../src/ai/aiClient';
import { translate } from '../src/ai/translator';
import { translateMessageInBackground } from '../src/ai/translationPipeline';
import { generateSummary } from '../src/ai/summarizer';
import { runBotTurn } from '../src/ai/consultationBot';
import { createMessageRow } from '../src/messages/messageService';
import { drainBackground } from '../src/common/background';

const app = createApp();
let cookie: string;
beforeEach(async () => {
  await resetDatabase();
  const { operator } = await createOperator();
  cookie = `${config.adminCookieName}=${signOperatorToken({ operatorId: operator.id, role: 'operator' })}`;
});
afterEach(async () => { await drainBackground(); setModelCaller(null); vi.unstubAllGlobals(); await resetDatabase(); });
afterAll(disconnectDatabase);
const start = (mode = 'assisted') => request(app).post('/api/public/chat/start').send({
  name: 'mode test', phone: '01012345678', preferredLanguage: 'ja', serviceType: 'korea_travel',
  consultationMode: mode, message: 'こんにちは', privacyAgreed: true
});

it('settings require login, validate provider and reject stale writes', async () => {
  expect((await request(app).get('/api/admin/settings/chat')).status).toBe(401);
  expect((await request(app).put('/api/admin/settings/chat').send(DEFAULT_CHAT_SETTINGS)).status).toBe(401);
  expect((await request(app).post('/api/admin/settings/chat/test-translation').send({ provider: 'ollama' })).status).toBe(401);
  const initial = await request(app).get('/api/admin/settings/chat').set('Cookie', cookie);
  expect(initial.body.settings).toEqual(DEFAULT_CHAT_SETTINGS);
  const endpoint = '/api/admin/settings/chat';
  expect((await request(app).put(endpoint).set('Cookie', cookie).send({ ...DEFAULT_CHAT_SETTINGS, translationProvider: 'invalid' })).status).toBe(400);
  expect((await request(app).put(endpoint).set('Cookie', cookie).send({ ...DEFAULT_CHAT_SETTINGS, translationProvider: 'ollama' })).status).toBe(200);
  expect((await getChatSettings()).translationProvider).toBe('ollama');
  expect((await request(app).put(endpoint).set('Cookie', cookie).send(DEFAULT_CHAT_SETTINGS)).status).toBe(409);
});

it('human mode bypasses every model path, preserves original messages and survives reopening', async () => {
  const caller = vi.fn(); setModelCaller(caller);
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const created = await start('human');
  expect(created.status).toBe(201); expect(created.body.status).toBe('waiting');
  const id = created.body.roomId;
  const room = await prisma.chatRoom.findUniqueOrThrow({ where: { id } });
  expect(room.consultationMode).toBe('human');
  const row = await createMessageRow({ chatRoomId: id, senderType: 'customer', text: '明日お願いします', originalLanguage: 'ja' });
  await translateMessageInBackground(null, row.id);
  await runBotTurn(null, id); await generateSummary(id); await drainBackground();
  expect(caller).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
  expect(await prisma.message.count({ where: { chatRoomId: id, senderType: 'ai' } })).toBe(0);
  const preview = await request(app).post('/api/admin/translate/preview').set('Cookie', cookie).send({ roomId: id, text: '원문', sourceLanguage: 'ko', targetLanguage: 'ja' });
  expect(preview.body).toMatchObject({ translatedText: '원문', translationEnabled: false });
  await expect(createMessageRow({ chatRoomId: id, senderType: 'operator', text: '원문 답변', translatedText: '번역', visibleText: '번역', translationStatus: 'done', translatedLanguage: 'ja' })).rejects.toMatchObject({ code: 'TRANSLATION_DISABLED' });
  const op = await createMessageRow({ chatRoomId: id, senderType: 'operator', text: '원문 답변' });
  expect(op).toMatchObject({ visibleText: '원문 답변', translatedText: null, translationStatus: 'none' });
  await request(app).patch(`/api/admin/chat-rooms/${id}/status`).set('Cookie', cookie).send({ status: 'closed' });
  await request(app).patch(`/api/admin/chat-rooms/${id}/status`).set('Cookie', cookie).send({ status: 'active' });
  expect((await prisma.chatRoom.findUniqueOrThrow({ where: { id } })).consultationMode).toBe('human');
});

it('switching AI off moves bot rooms to waiting and blocks new AI greetings', async () => {
  setModelCaller(async () => '안녕하세요');
  const first = await start(); await drainBackground();
  await saveChatSettings({ ...DEFAULT_CHAT_SETTINGS, aiEnabled: false });
  expect((await prisma.chatRoom.findUniqueOrThrow({ where: { id: first.body.roomId } })).status).toBe('waiting');
  const next = await start(); await drainBackground();
  expect(next.body.status).toBe('waiting');
  expect(await prisma.message.count({ where: { chatRoomId: next.body.roomId, senderType: 'ai' } })).toBe(0);
  await saveChatSettings({ ...(await getChatSettings()), aiEnabled: true });
  expect((await prisma.chatRoom.findUniqueOrThrow({ where: { id: first.body.roomId } })).status).toBe('waiting');
});

it('Ollama selection sends non-thinking requests only to local provider and strips thinking', async () => {
  const external = vi.fn(); setModelCaller(external);
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ done: true, message: { content: '<think>internal</think>내일 오후 3시입니다.' } }), { status: 200 }));
  vi.stubGlobal('fetch', fetcher);
  await saveChatSettings({ ...DEFAULT_CHAT_SETTINGS, translationProvider: 'ollama' });
  expect(await translate({ text: '明日の午後3時です。', source: 'ja', target: 'ko' })).toMatchObject({ status: 'done', text: '내일 오후 3시입니다.', model: 'qwen3:8b' });
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ model: 'qwen3:8b', stream: false, think: false });
  expect(fetcher.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  fetcher.mockRejectedValue(new Error('offline'));
  expect((await translate({ text: '明日', source: 'ja', target: 'ko' })).status).toBe('failed');
  expect(external).not.toHaveBeenCalled();
});

it('translation disabled never invokes either provider', async () => {
  const caller = vi.fn(); setModelCaller(caller); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  await saveChatSettings({ ...DEFAULT_CHAT_SETTINGS, translationEnabled: false });
  expect(await translate({ text: '明日', source: 'ja', target: 'ko' })).toEqual({ status: 'skipped', text: '明日' });
  expect(caller).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
});

it('rejects partial/truncated Ollama responses instead of exposing them', async () => {
  await saveChatSettings({ ...DEFAULT_CHAT_SETTINGS, translationProvider: 'ollama' });
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ done: true, done_reason: 'length', message: { content: 'incomplete' } })));
  vi.stubGlobal('fetch', fetcher);
  expect((await translate({ text: '明日', source: 'ja', target: 'ko' })).status).toBe('failed');
});

it('discards an in-flight translation after provider/settings change', async () => {
  const created = await start('human');
  const id = created.body.roomId;
  await drainBackground();
  // Test fixture switches this room to assisted before starting the model request.
  await prisma.chatRoom.update({ where: { id }, data: { consultationMode: 'assisted', translationEnabled: true } });
  const row = await createMessageRow({ chatRoomId: id, senderType: 'customer', text: '明日です', originalLanguage: 'ja' });
  let finish!: (text: string) => void;
  let started!: () => void;
  const entered = new Promise<void>(resolve => { started = resolve; });
  setModelCaller(() => { started(); return new Promise<string>(resolve => { finish = resolve; }); });
  const work = translateMessageInBackground(null, row.id);
  await entered;
  await saveChatSettings({ ...DEFAULT_CHAT_SETTINGS, translationEnabled: false });
  finish('내일입니다'); await work;
  expect(await prisma.message.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ translatedText: null, translationStatus: 'none' });
});

it('cancels the Ollama request when its timeout expires', async () => {
  const { callOllama } = await import('../src/ai/ollamaClient');
  const fetcher = vi.fn((_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  }));
  vi.stubGlobal('fetch', fetcher);
  await expect(callOllama({ model: 'qwen3:8b', system: 'translate', user: 'hello', timeoutMs: 10 })).rejects.toThrow('aborted');
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
});

it('human 상담도 상호 번역을 켜면 일본어 문의를 번역하고 수정한 일본어 답변을 전달한다', async () => {
  const caller = vi.fn(async (input: { user: string }) => input.user === '한국어 답변' ? '日本語の回答' : '안녕하세요');
  setModelCaller(caller);
  const created = await start('human');
  const id = created.body.roomId;
  await drainBackground(); expect(caller).not.toHaveBeenCalled();
  const route = `/api/admin/chat-rooms/${id}/translation`;
  expect((await request(app).patch(route).send({ enabled: true, revision: 0 })).status).toBe(401);
  const enabled = await request(app).patch(route).set('Cookie', cookie).send({ enabled: true, revision: 0 });
  expect(enabled.status).toBe(200);
  expect(enabled.body.room).toMatchObject({ consultationMode: 'human', translationEnabled: true, roomTranslationEnabled: true, translationRevision: 1 });
  await drainBackground();
  const customerMessage = await prisma.message.findFirstOrThrow({ where: { chatRoomId: id, senderType: 'customer' } });
  expect(customerMessage).toMatchObject({ originalText: 'こんにちは', translatedText: '안녕하세요', translatedLanguage: 'ko' });
  const preview = await request(app).post('/api/admin/translate/preview').set('Cookie', cookie).send({ roomId: id, text: '한국어 답변', sourceLanguage: 'ko', targetLanguage: 'ja' });
  expect(preview.body.translatedText).toBe('日本語の回答');
  const sent = await request(app).post(`/api/admin/chat-rooms/${id}/messages`).set('Cookie', cookie).send({ originalText: '한국어 답변', originalLanguage: 'ko', translatedText: '修正した日本語の回答', translatedLanguage: 'ja', translationEdited: true });
  expect(sent.status).toBe(201); expect(sent.body.message.translationStatus).toBe('edited');
  const received = await request(app).get(`/api/public/chat/${id}`).set('X-Visitor-Token', created.body.visitorToken);
  expect(received.body.messages.find((m: { senderType: string }) => m.senderType === 'operator').visibleText).toBe('修正した日本語の回答');
  await runBotTurn(null, id); await generateSummary(id);
  expect(await prisma.message.count({ where: { chatRoomId: id, senderType: 'ai' } })).toBe(0);
  expect(await prisma.chatSummary.count({ where: { chatRoomId: id } })).toBe(0);
  expect((await request(app).patch(route).set('Cookie', cookie).send({ enabled: false, revision: 0 })).status).toBe(409);
  const disabled = await request(app).patch(route).set('Cookie', cookie).send({ enabled: false, revision: 1 });
  expect(disabled.body.room.translationEnabled).toBe(false);
  expect((await prisma.message.findUniqueOrThrow({ where: { id: customerMessage.id } })).translatedText).toBe('안녕하세요');
});

it('방별 번역을 끄면 진행 중 번역 결과를 버리고 이전 번역 초안의 전송을 거절한다', async () => {
  const created = await start('human'); const id = created.body.roomId; await drainBackground();
  await request(app).patch(`/api/admin/chat-rooms/${id}/translation`).set('Cookie', cookie).send({ enabled: true, revision: 0 });
  await drainBackground();
  const row = await createMessageRow({ chatRoomId: id, senderType: 'customer', text: '明日です', originalLanguage: 'ja' });
  let finish!: (text: string) => void; let started!: () => void;
  const entered = new Promise<void>(r => { started = r; });
  setModelCaller(() => { started(); return new Promise<string>(r => { finish = r; }); });
  const work = translateMessageInBackground(null, row.id); await entered;
  await request(app).patch(`/api/admin/chat-rooms/${id}/translation`).set('Cookie', cookie).send({ enabled: false, revision: 1 });
  finish('내일입니다'); await work;
  expect(await prisma.message.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ translatedText: null, translationStatus: 'none' });
  await expect(createMessageRow({ chatRoomId: id, senderType: 'operator', text: '답변', translatedText: '回答' })).rejects.toMatchObject({ code: 'TRANSLATION_DISABLED' });
});
