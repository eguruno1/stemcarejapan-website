import { Prisma } from '@prisma/client';
import type { ChatFeedbackDTO, SubmitFeedbackRequest } from '@stemcare/shared';
import { conflict } from '../common/errors';
import { prisma } from '../db';
import { lockRoom } from '../chatRooms/roomLock';

export async function submitFeedback(
  roomId: string,
  input: SubmitFeedbackRequest
): Promise<ChatFeedbackDTO> {
  return prisma.$transaction(async tx => {
    const room = await lockRoom(tx, roomId);

    // 아직 상담 중인데 평가를 받으면 의미가 없다.
    if (room.status !== 'closed') {
      throw conflict('ROOM_NOT_CLOSED', '상담이 종료된 후에 평가할 수 있습니다.');
    }

    try {
      const created = await tx.chatFeedback.create({
        data: {
          chatRoomId: roomId,
          rating: input.rating,
          comment: input.comment?.trim() || null
        }
      });

      return {
        id: created.id,
        rating: created.rating,
        comment: created.comment,
        createdAt: created.createdAt.toISOString()
      };
    } catch (err) {
      // P2002 = chatRoomId unique 위반 = 이미 평가함
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw conflict('ALREADY_SUBMITTED', '이미 평가를 남기셨습니다. 감사합니다.');
      }
      throw err;
    }
  });
}

/** 최근 N일 평균 평점. 평가가 없으면 null */
export async function averageRating(days: number): Promise<{ avg: number | null; count: number }> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const result = await prisma.chatFeedback.aggregate({
    where: { createdAt: { gte: since } },
    _avg: { rating: true },
    _count: { _all: true }
  });

  return {
    // 소수점 둘째 자리까지만 쓴다. 화면에 4.333333 이 뜨면 지저분하다.
    avg: result._avg.rating === null ? null : Math.round(result._avg.rating * 100) / 100,
    count: result._count._all
  };
}
