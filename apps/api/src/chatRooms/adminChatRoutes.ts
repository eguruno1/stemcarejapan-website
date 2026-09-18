import { Router } from 'express';
import { z } from 'zod';
import { CHAT_ROOM_STATUSES, LANGUAGES } from '@stemcare/shared';
import { requireOperator } from '../auth/requireOperator';
import { asyncHandler } from '../common/asyncHandler';
import { notFound } from '../common/errors';
import { validateBody, validateQuery } from '../common/validate';
import { prisma } from '../db';
import { createMessage } from '../messages/messageService';
import { createNote } from '../notes/noteService';
import {
  assertRoomOpen,
  assignRoom,
  getRoomDetailAndMarkRead,
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
    const room = await assignRoom(req.params.roomId, req.operator!.operatorId);
    res.json({ room });
  })
);

adminChatRoutes.patch(
  '/:roomId/status',
  validateBody(StatusSchema),
  asyncHandler(async (req, res) => {
    const { status } = req.body as z.infer<typeof StatusSchema>;
    const room = await updateRoomStatus(req.params.roomId, status, req.operator!.operatorId);
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

    const message = await createMessage({
      chatRoomId: room.id,
      senderType: 'operator',
      senderId: req.operator!.operatorId,
      text: body.originalText,
      originalLanguage: body.originalLanguage,
      translatedText: body.translatedText ?? null,
      translatedLanguage: body.translatedLanguage ?? null,
      // 고객이 실제로 볼 문장: 번역문이 있으면 번역문, 없으면 원문
      visibleText: hasTranslation ? body.translatedText : body.originalText,
      translationStatus: hasTranslation ? 'done' : 'none',
      clientMessageId: body.clientMessageId ?? null,
      viewer: 'operator'
    });

    res.status(201).json({ message });
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
