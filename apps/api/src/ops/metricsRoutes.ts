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
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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
      prisma.chatRoom.count({
        where: {
          status: { in: ['waiting', 'active'] },
          lastMessageAt: { lt: tenMinutesAgo }
        }
      }),
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
