import { Router } from 'express';
import { z } from 'zod';
import { CHAT_ROOM_STATUSES } from '@stemcare/shared';
import { requireOperator } from '../auth/requireOperator';
import { asyncHandler } from '../common/asyncHandler';
import { validateQuery } from '../common/validate';
import { getRoomDetail, listRooms, markRoomRead } from './chatRoomService';

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
    const room = await getRoomDetail(req.params.roomId);
    await markRoomRead(room.id);
    res.json({ room });
  })
);
