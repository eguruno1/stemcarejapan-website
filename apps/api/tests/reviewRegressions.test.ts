import request from 'supertest';
import { afterAll, beforeEach, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/db';
import { createCustomerWithRoom, createOperator } from './helpers/factories';
import { resetDatabase, disconnectDatabase } from './helpers/testDb';
import * as messageService from '../src/messages/messageService';
import { startChat } from '../src/chatRooms/chatRoomService';
const app = createApp();
beforeEach(resetDatabase);
afterAll(disconnectDatabase);
async function login() {
  const { operator, plainPassword } = await createOperator();
  const agent = request.agent(app);
  await agent.post('/api/admin/auth/login').send({ email: operator.email, password: plainPassword }).expect(200);
  return { agent, operator };
}
it('비활성화 후 기존 쿠키도 관리자 API를 사용할 수 없다', async () => {
  const { agent, operator } = await login();
  await prisma.operator.update({ where: { id: operator.id }, data: { isActive: false } });
  await agent.get('/api/admin/chat-rooms').expect(401);
});
it('동시 배정은 한 운영자만 성공하고 참여 메시지는 한 건이다', async () => {
  const a = await login(); const b = await login();
  const { room } = await createCustomerWithRoom();
  const responses = await Promise.all([a, b].map(({ agent }) => agent.patch(`/api/admin/chat-rooms/${room.id}/assign`)));
  expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
  expect(await prisma.message.count({ where: { chatRoomId: room.id } })).toBe(1);
});
it('반복 종료는 종료 시각과 시스템 메시지를 유지한다', async () => {
  const { agent } = await login(); const { room } = await createCustomerWithRoom();
  const a = await agent.patch(`/api/admin/chat-rooms/${room.id}/status`).send({ status: 'closed' }).expect(200);
  const b = await agent.patch(`/api/admin/chat-rooms/${room.id}/status`).send({ status: 'closed' }).expect(200);
  expect(b.body.room.closedAt).toBe(a.body.room.closedAt);
  expect(await prisma.message.count({ where: { chatRoomId: room.id } })).toBe(1);
});
it('다른 발신자의 메시지 ID 충돌은 재전송으로 처리하지 않는다', async () => {
  const { agent } = await login(); const { room, visitorToken } = await createCustomerWithRoom();
  await agent.post(`/api/admin/chat-rooms/${room.id}/messages`).send({ originalText: '답변', originalLanguage: 'ko', clientMessageId: 'collision' }).expect(201);
  await request(app).post(`/api/public/chat/${room.id}/messages`).set('X-Visitor-Token', visitorToken).send({ text: '문의', clientMessageId: 'collision' }).expect(409);
});
it('빈 재전송 ID와 불완전한 번역은 400이다', async () => {
  const { agent } = await login(); const { room, visitorToken } = await createCustomerWithRoom();
  await request(app).post(`/api/public/chat/${room.id}/messages`).set('X-Visitor-Token', visitorToken).send({ text: '문의', clientMessageId: '' }).expect(400);
  for (const translation of [{ translatedText: '翻訳' }, { translatedLanguage: 'ja' }, { translatedText: '  ', translatedLanguage: 'ja' }]) {
    await agent.post(`/api/admin/chat-rooms/${room.id}/messages`).send({ originalText: '답변', originalLanguage: 'ko', ...translation }).expect(400);
  }
});
it('잘못된 JSON은 내부 오류가 아닌 400이다', async () => {
  const res = await request(app).post('/api/public/chat/start').set('Content-Type', 'application/json').send('{');
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('INVALID_JSON');
});
it('상세 조회 직후 도착한 고객 메시지는 읽지 않음으로 남는다', async () => {
  const { agent } = await login(); const { room, visitorToken } = await createCustomerWithRoom();
  await agent.get(`/api/admin/chat-rooms/${room.id}`).expect(200);
  await request(app).post(`/api/public/chat/${room.id}/messages`).set('X-Visitor-Token', visitorToken).send({ text: '새 문의' }).expect(201);
  const res = await agent.get('/api/admin/chat-rooms').expect(200);
  expect(res.body.rooms[0].unreadCount).toBe(1);
});
it('최근 메시지 정렬에서 메시지 없는 방이 먼저 나오지 않는다', async () => {
  const { agent } = await login();
  const { room, visitorToken } = await createCustomerWithRoom();
  await request(app).post(`/api/public/chat/${room.id}/messages`).set('X-Visitor-Token', visitorToken).send({ text: '문의' }).expect(201);
  await createCustomerWithRoom();
  const res = await agent.get('/api/admin/chat-rooms').expect(200);
  expect(res.body.rooms[0].id).toBe(room.id);
});

it('첫 메시지 실패 시 고객과 상담방 생성도 롤백한다', async () => {
  const save = vi.spyOn(messageService, 'createMessage').mockRejectedValueOnce(new Error('저장 실패'));
  try {
    await expect(startChat({ name: '테스트', phone: '12345', preferredLanguage: 'ja', serviceType: 'undecided', privacyAgreed: true, message: '문의' })).rejects.toThrow('저장 실패');
    expect(await prisma.customer.count()).toBe(0);
    expect(await prisma.chatRoom.count()).toBe(0);
  } finally { save.mockRestore(); }
});
it('전송 서비스도 종료 상태를 확인하고 동시 재전송은 한 건만 저장한다', async () => {
  const { room, customer } = await createCustomerWithRoom();
  const input = { chatRoomId: room.id, senderType: 'customer' as const, senderId: customer.id, text: '문의', clientMessageId: 'retry' };
  const [a, b] = await Promise.all([messageService.createMessage(input), messageService.createMessage(input)]);
  expect(a.id).toBe(b.id);
  expect(await prisma.message.count()).toBe(1);
  await prisma.chatRoom.update({ where: { id: room.id }, data: { status: 'closed' } });
  await expect(messageService.createMessage({ ...input, clientMessageId: 'next' })).rejects.toMatchObject({ code: 'ROOM_CLOSED' });
  expect(await prisma.message.count()).toBe(1);
});
