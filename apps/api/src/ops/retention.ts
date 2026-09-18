import { randomBytes } from 'node:crypto';
import { prisma } from '../db';
import { lockRoom } from '../chatRooms/roomLock';
import { logger } from '../common/logger';

/**
 * 개인정보 보관 정책.
 *
 * 스펙 12절: "불필요한 정보를 오래 보관하지 않는 정책이 필요하다."
 *
 * - 상담 종료 후 180일: 이름·전화·이메일을 비식별화한다.
 *   (누구인지 알 수 없게 하되, "몇 건의 상담이 있었나" 통계는 남긴다)
 * - 상담 종료 후 365일: 대화 본문을 삭제한다.
 *   (건강 관련 언급이 있을 수 있으므로 오래 두지 않는다)
 *
 * 실제 운영 정책이 정해지면 이 상수만 바꾸면 된다.
 */
export const PSEUDONYMIZE_AFTER_DAYS = 180;
export const DELETE_MESSAGES_AFTER_DAYS = 365;

function daysBefore(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export async function pseudonymizeOldCustomers(now = new Date()): Promise<number> {
  const cutoff = daysBefore(now, PSEUDONYMIZE_AFTER_DAYS);

  const targets = await prisma.customer.findMany({
    where: {
      pseudonymizedAt: null,
      // 이 고객의 모든 상담이 종료되었고, 가장 최근 종료가 기준일보다 오래됐다.
      chatRooms: {
        every: { status: 'closed', closedAt: { lt: cutoff } },
        some: {}
      }
    },
    select: { id: true }
  });

  let count = 0;
  for (const target of targets) {
    count += await prisma.$transaction(async tx => {
      const rooms = await tx.chatRoom.findMany({ where: { customerId: target.id }, orderBy: { id: 'asc' } });
      for (const entry of rooms) await lockRoom(tx, entry.id);
      const eligible = await tx.customer.findFirst({ where: {
        id: target.id, pseudonymizedAt: null,
        chatRooms: { every: { status: 'closed', closedAt: { lt: cutoff } }, some: {} }
      } });
      if (!eligible) return 0;
      await tx.customer.update({ where: { id: target.id }, data: {
        name: `고객_${randomBytes(2).toString('hex')}`, phone: '[삭제됨]',
        email: null, memo: null, pseudonymizedAt: now
      } });
      return 1;
    });
  }

  if (count > 0) {
    logger.info({ count, policy: 'pseudonymize', afterDays: PSEUDONYMIZE_AFTER_DAYS }, 'retention_done');
  }

  return count;
}

export async function deleteOldMessages(now = new Date()): Promise<number> {
  const cutoff = daysBefore(now, DELETE_MESSAGES_AFTER_DAYS);

  const oldRooms = await prisma.chatRoom.findMany({
    where: { status: 'closed', closedAt: { lt: cutoff } },
    select: { id: true }
  });

  if (oldRooms.length === 0) return 0;

  let deleted = 0;
  for (const candidate of oldRooms) {
    deleted += await prisma.$transaction(async tx => {
      const room = await lockRoom(tx, candidate.id);
      if (room.status !== 'closed' || !room.closedAt || room.closedAt >= cutoff) return 0;
      const result = await tx.message.deleteMany({ where: { chatRoomId: room.id } });
      await tx.chatSummary.deleteMany({ where: { chatRoomId: room.id } });
      await tx.operatorNote.deleteMany({ where: { chatRoomId: room.id } });
      await tx.chatFeedback.deleteMany({ where: { chatRoomId: room.id } });
      return result.count;
    });
  }
  if (deleted) logger.info({ count: deleted, policy: 'delete_messages' }, 'retention_done');
  return deleted;
}

export async function runRetention(now = new Date()): Promise<{ pseudonymized: number; deleted: number }> {
  const deleted = await deleteOldMessages(now);
  const pseudonymized = await pseudonymizeOldCustomers(now);
  return { pseudonymized, deleted };
}
