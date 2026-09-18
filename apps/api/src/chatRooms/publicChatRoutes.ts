import { Router } from 'express';
import { z } from 'zod';
import { LANGUAGES, SERVICE_TYPES } from '@stemcare/shared';
import { asyncHandler } from '../common/asyncHandler';
import { validateBody } from '../common/validate';
import { prisma } from '../db';
import { createMessageRow, listMessages } from '../messages/messageService';
import { toMessageDTO } from '../messages/messageMapper';
import { broadcastMessage, broadcastStatus, notifyOperators } from '../realtime/emitters';
import { getIo } from '../realtime/socketServer';
import { assertRoomOpen, authorizeVisitor, requestHandoff, startChat } from './chatRoomService';

const StartChatSchema = z.object({
  name: z.string().trim().min(1, '성함을 입력해주세요.').max(50),
  phone: z.string().trim().min(5, '연락처를 입력해주세요.').max(30),
  email: z.string().email('올바른 이메일 형식이 아닙니다.').optional().or(z.literal('')),
  preferredLanguage: z.enum(LANGUAGES),
  serviceType: z.enum(SERVICE_TYPES),
  sourcePage: z.string().max(200).optional(),
  message: z.string().max(2000).optional(),
  privacyAgreed: z.literal(true, {
    errorMap: () => ({ message: '개인정보 수집·이용에 동의해주세요.' })
  })
});

const CustomerMessageSchema = z.object({
  text: z.string().trim().min(1, '메시지를 입력해주세요.').max(2000),
  clientMessageId: z.string().trim().min(1).max(100).optional()
});

function visitorTokenOf(req: { header(name: string): string | undefined }): string | undefined {
  return req.header('X-Visitor-Token');
}

export const publicChatRoutes = Router();

publicChatRoutes.post(
  '/start',
  validateBody(StartChatSchema),
  asyncHandler(async (req, res) => {
    const result = await startChat(req.body as z.infer<typeof StartChatSchema>);

    const io = getIo();
    if (io) notifyOperators(io, { roomId: result.roomId, kind: 'chat_started' });

    res.status(201).json(result);
  })
);

publicChatRoutes.get(
  '/:roomId',
  asyncHandler(async (req, res) => {
    const room = await authorizeVisitor(req.params.roomId, visitorTokenOf(req));
    const customer = await prisma.customer.findUniqueOrThrow({ where: { id: room.customerId } });
    const messages = await listMessages(room.id, 'customer');

    // 고객 화면에는 전화번호/이메일 같은 개인정보를 다시 돌려주지 않는다.
    res.json({
      roomId: room.id,
      status: room.status,
      serviceType: room.serviceType,
      customerName: customer.name,
      preferredLanguage: customer.preferredLanguage,
      createdAt: room.createdAt.toISOString(),
      messages
    });
  })
);

publicChatRoutes.post(
  '/:roomId/messages',
  validateBody(CustomerMessageSchema),
  asyncHandler(async (req, res) => {
    const room = await authorizeVisitor(req.params.roomId, visitorTokenOf(req));
    assertRoomOpen(room);

    const body = req.body as z.infer<typeof CustomerMessageSchema>;
    const customer = await prisma.customer.findUniqueOrThrow({ where: { id: room.customerId } });

    const row = await createMessageRow({
      chatRoomId: room.id,
      senderType: 'customer',
      senderId: customer.id,
      text: body.text,
      originalLanguage: customer.preferredLanguage as 'ko' | 'ja',
      clientMessageId: body.clientMessageId ?? null
    });

    const io = getIo();
    if (io) await broadcastMessage(io, room.id, row);

    res.status(201).json({ message: toMessageDTO(row, 'customer') });
  })
);

// 소켓 차단 환경에서도 동일한 상태 전환을 수행한다.
publicChatRoutes.post('/:roomId/handoff', asyncHandler(async (req, res) => {
  const room = await authorizeVisitor(req.params.roomId, visitorTokenOf(req));
  const result = await requestHandoff(room.id);
  const io = getIo();
  if (io) {
    if (result.notice) await broadcastMessage(io, room.id, result.notice);
    broadcastStatus(io, room.id, result.status, result.assignedOperatorId);
  }
  res.json({ status: result.status });
}));
