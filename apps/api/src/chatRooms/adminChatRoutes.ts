import { lockChatConfiguration } from '../settings/chatSettings';
import { lockRoom } from './roomLock';
import { trackBackground } from '../common/background';
import { conflict } from '../common/errors';
import { Router } from 'express';
import { z } from 'zod';
import { CHAT_ROOM_STATUSES, LANGUAGES } from '@stemcare/shared';
import { requireOperator } from '../auth/requireOperator';
import { asyncHandler } from '../common/asyncHandler';
import { notFound } from '../common/errors';
import { validateBody, validateQuery } from '../common/validate';
import { prisma } from '../db';
import { createMessageRow } from '../messages/messageService';
import { toMessageDTO } from '../messages/messageMapper';
import { createNote } from '../notes/noteService';
import { retryTranslation, translateRecentMessages } from '../ai/translationPipeline';
import { broadcastMessage, broadcastStatus } from '../realtime/emitters';
import { getIo } from '../realtime/socketServer';
import {
  assertRoomOpen,
  assignRoom,
  getRoomDetailAndMarkRead,
  getRoomDetail,
  listCustomerHistory,
  listRooms,
  updateRoomStatus
} from './chatRoomService';

const ListQuerySchema = z.object({
  status: z.enum(CHAT_ROOM_STATUSES).optional(),
  mine: z.enum(['true', 'false']).optional(),
  sort: z.enum(['recent', 'oldest_waiting']).optional()
});

export const adminChatRoutes = Router();

// 이 라우터의 모든 경로는 로그인이 필요하다.
adminChatRoutes.use(requireOperator);

adminChatRoutes.get(
  '/',
  validateQuery(ListQuerySchema),
  asyncHandler(async (req, res) => {
    const query = (req as unknown as { validatedQuery: z.infer<typeof ListQuerySchema> }).validatedQuery;

    const rooms = await listRooms({
      status: query.status,
      assignedOperatorId: query.mine === 'true' ? req.operator!.operatorId : undefined,
      sort: query.sort
    });

    res.json({ rooms });
  })
);

adminChatRoutes.get(
  '/:roomId',
  asyncHandler(async (req, res) => {
    const room = await getRoomDetailAndMarkRead(req.params.roomId);
    res.json({ room });
  })
);

/* ---------- 배정 / 상태 / 메시지 / 메모 (Task 8) ---------- */

const StatusSchema = z.object({ status: z.enum(CHAT_ROOM_STATUSES) });

const OperatorMessageSchema = z.object({
  originalText: z.string().trim().min(1, '메시지를 입력해주세요.').max(2000),
  originalLanguage: z.enum(LANGUAGES),
  translatedText: z.string().trim().min(1).max(2000).optional(),
  translatedLanguage: z.enum(LANGUAGES).optional(),
  /** 운영자가 previewTranslation 이 만들어 준 번역문을 손으로 고쳤는지 */
  translationEdited: z.boolean().optional(),
  clientMessageId: z.string().trim().min(1).max(100).optional()
}).refine(body => (body.translatedText !== undefined) === (body.translatedLanguage !== undefined), {
  message: '번역문과 번역 언어를 함께 입력해주세요.', path: ['translatedText']
});

const NoteSchema = z.object({
  note: z.string().trim().min(1, '메모 내용을 입력해주세요.').max(2000)
});

adminChatRoutes.patch(
  '/:roomId/assign',
  asyncHandler(async (req, res) => {
    const { room, notice } = await assignRoom(req.params.roomId, req.operator!.operatorId);

    const io = getIo();
    if (io) {
      if (notice) await broadcastMessage(io, room.id, notice);
      broadcastStatus(io, room.id, room.status, room.assignedOperatorId);
    }

    res.json({ room });
  })
);

adminChatRoutes.patch(
  '/:roomId/status',
  validateBody(StatusSchema),
  asyncHandler(async (req, res) => {
    const { status } = req.body as z.infer<typeof StatusSchema>;
    const { room, notice } = await updateRoomStatus(req.params.roomId, status, req.operator!.operatorId);

    const io = getIo();
    if (io) {
      if (notice) await broadcastMessage(io, room.id, notice);
      broadcastStatus(io, room.id, room.status, room.assignedOperatorId);
    }

    res.json({ room });
  })
);

adminChatRoutes.post(
  '/:roomId/messages',
  validateBody(OperatorMessageSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof OperatorMessageSchema>;

    const room = await prisma.chatRoom.findUnique({ where: { id: req.params.roomId } });
    if (!room) throw notFound('상담방을 찾을 수 없습니다.');
    assertRoomOpen(room);

    const hasTranslation = Boolean(body.translatedText && body.translatedLanguage);
    const translationStatus = hasTranslation ? (body.translationEdited ? 'edited' : 'done') : 'none';

    const row = await createMessageRow({
      chatRoomId: room.id,
      senderType: 'operator',
      senderId: req.operator!.operatorId,
      text: body.originalText,
      originalLanguage: body.originalLanguage,
      translatedText: body.translatedText ?? null,
      translatedLanguage: body.translatedLanguage ?? null,
      // 고객이 실제로 볼 문장: 번역문이 있으면 번역문, 없으면 원문
      visibleText: hasTranslation ? body.translatedText : body.originalText,
      translationStatus,
      clientMessageId: body.clientMessageId ?? null
    });

    const io = getIo();
    if (io) await broadcastMessage(io, room.id, row);

    res.status(201).json({ message: toMessageDTO(row, 'operator') });
  })
);

adminChatRoutes.post(
  '/:roomId/notes',
  validateBody(NoteSchema),
  asyncHandler(async (req, res) => {
    const { note } = req.body as z.infer<typeof NoteSchema>;
    const created = await createNote(req.params.roomId, req.operator!.operatorId, note);
    res.status(201).json({ note: created });
  })
);

adminChatRoutes.get(
  '/:roomId/customer-history',
  asyncHandler(async (req, res) => {
    const room = await prisma.chatRoom.findUnique({ where: { id: req.params.roomId } });
    if (!room) throw notFound('상담방을 찾을 수 없습니다.');

    const history = await listCustomerHistory(room.customerId, room.id);
    res.json({ history });
  })
);

adminChatRoutes.post(
  '/:roomId/messages/:messageId/retranslate',
  asyncHandler(async (req, res) => {
    const message = await prisma.message.findUnique({ where: { id: req.params.messageId } });
    if (!message || message.chatRoomId !== req.params.roomId) {
      throw notFound('메시지를 찾을 수 없습니다.');
    }

    await retryTranslation(getIo(), message.id);

    const updated = await prisma.message.findUniqueOrThrow({ where: { id: message.id } });
    res.json({ message: toMessageDTO(updated, 'operator') });
  })
);


adminChatRoutes.patch('/:roomId/translation',
  validateBody(z.object({ enabled: z.boolean(), revision: z.number().int().nonnegative() }).strict()),
  asyncHandler(async (req, res) => {
    await prisma.$transaction(async tx => {
      await lockChatConfiguration(tx);
      const room = await lockRoom(tx, req.params.roomId);
      if (room.translationRevision !== req.body.revision) throw conflict('SETTINGS_CHANGED', '다른 운영자가 상담 번역 설정을 변경했습니다. 새로고침 후 다시 시도해주세요.');
      await tx.chatRoom.update({ where: { id: room.id }, data: { translationEnabled: req.body.enabled, translationRevision: { increment: 1 } } });
    });
    const room = await getRoomDetail(req.params.roomId);
    if (room.translationEnabled) trackBackground(translateRecentMessages(getIo(), room.id));
    res.json({ room });
  })
);
