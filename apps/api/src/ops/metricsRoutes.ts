import { Router } from 'express';
import type { OpsMetrics } from '@stemcare/shared';
import { requireOperator } from '../auth/requireOperator';
import { asyncHandler } from '../common/asyncHandler';
import { prisma } from '../db';
import { averageRating } from '../feedback/feedbackService';
import { getIo } from '../realtime/socketServer';

export const metricsRoutes = Router();

metricsRoutes.use(requireOperator);

metricsRoutes.get(
  '/metrics',
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const koreaDate = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const startOfToday = new Date(Date.UTC(koreaDate.getUTCFullYear(), koreaDate.getUTCMonth(), koreaDate.getUTCDate()) - 9 * 60 * 60 * 1000);
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    let dbOk = true;
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbOk = false;
    }

    const [
      waitingRooms,
      activeRooms,
      botRooms,
      todayStarted,
      unansweredOver10Min,
      translationFailures24h,
      ratingStats
    ] = await Promise.all([
      prisma.chatRoom.count({ where: { status: 'waiting' } }),
      prisma.chatRoom.count({ where: { status: 'active' } }),
      prisma.chatRoom.count({ where: { status: 'bot' } }),
      prisma.chatRoom.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*) AS count FROM chat_rooms r
        WHERE r.status IN ('waiting', 'active') AND EXISTS (
          SELECT 1 FROM messages c WHERE c.chat_room_id = r.id AND c.sender_type = 'customer'
          AND c.created_at < ${tenMinutesAgo}
          AND c.created_at > COALESCE((SELECT max(o.created_at) FROM messages o
            WHERE o.chat_room_id = r.id AND o.sender_type = 'operator'), '-infinity'::timestamp)
        )
      `.then(rows => Number(rows[0].count)),
      prisma.message.count({
        where: { translationStatus: 'failed', createdAt: { gte: dayAgo } }
      }),
      averageRating(30)
    ]);

    const metrics: OpsMetrics = {
      waitingRooms,
      activeRooms,
      botRooms,
      todayStarted,
      unansweredOver10Min,
      translationFailures24h,
      socketConnections: getIo()?.sockets.sockets.size ?? 0,
      dbOk,
      avgRating30d: ratingStats.avg,
      feedbackCount30d: ratingStats.count
    };

    res.json({ metrics });
  })
);
