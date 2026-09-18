import { trackBackground } from '../common/background';
import { Router } from 'express';
import { z } from 'zod';
import { LANGUAGES, SERVICE_TYPES } from '@stemcare/shared';
import { asyncHandler } from '../common/asyncHandler';
import { validateBody } from '../common/validate';
import { prisma } from '../db';
import { createMessageResult, listMessages } from '../messages/messageService';
import { toMessageDTO } from '../messages/messageMapper';
import { generateSummary } from '../ai/summarizer';
import { runBotTurn } from '../ai/consultationBot';
import { translateMessageInBackground } from '../ai/translationPipeline';
import { submitFeedback } from '../feedback/feedbackService';
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

const FeedbackSchema = z.object({
  rating: z.number().int().min(1, '1~5 사이로 평가해주세요.').max(5, '1~5 사이로 평가해주세요.'),
  comment: z.string().max(1000).optional()
});

function visitorTokenOf(req: { header(name: string): string | undefined }): string | undefined {
  return req.header('X-Visitor-Token');
}

export const publicChatRoutes = Router();

publicChatRoutes.post(
  '/start',
  validateBody(StartChatSchema),
  asyncHandler(async (req, res) => {
    const { greeting, ...result } = await startChat(req.body as z.infer<typeof StartChatSchema>);

    const io = getIo();
    if (io) {
      notifyOperators(io, { roomId: result.roomId, kind: 'chat_started' });
      await broadcastMessage(io, result.roomId, greeting);
    }

    const first = await prisma.message.findFirst({ where: { chatRoomId: result.roomId, senderType: 'customer' } });
    if (first) trackBackground(translateMessageInBackground(io, first.id));
    if (result.status === 'waiting') trackBackground(generateSummary(result.roomId));
    // 일반 첫 문의는 고정 인사로 응답하고, 위험/운영자 요청은 startChat에서 즉시 전환한다.
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

    const { row, created } = await createMessageResult({
      chatRoomId: room.id,
      senderType: 'customer',
      senderId: customer.id,
      text: body.text,
      originalLanguage: customer.preferredLanguage as 'ko' | 'ja',
      clientMessageId: body.clientMessageId ?? null
    });

    const io = getIo();
    if (io) await broadcastMessage(io, room.id, row);

    // 원문을 먼저 응답한 뒤 번역을 시작한다. await 하지 않는다.
    trackBackground(translateMessageInBackground(io, row.id));
    if (created) trackBackground(runBotTurn(io, room.id));

    res.status(201).json({ message: toMessageDTO(row, 'customer') });
  })
);

// assertRoomOpen 을 쓰지 않는다 - 평가는 종료된 상담에만 하는 것이므로
// 반대 조건이다. 그 검사는 submitFeedback 안에 있다.
publicChatRoutes.post(
  '/:roomId/feedback',
  validateBody(FeedbackSchema),
  asyncHandler(async (req, res) => {
    const room = await authorizeVisitor(req.params.roomId, visitorTokenOf(req));
    const body = req.body as z.infer<typeof FeedbackSchema>;

    const feedback = await submitFeedback(room.id, {
      rating: body.rating as 1 | 2 | 3 | 4 | 5,
      comment: body.comment
    });

    res.status(201).json({ feedback });
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
