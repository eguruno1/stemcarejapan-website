import type { Prisma } from '@prisma/client';
import type { ChatSettingsDTO } from '@stemcare/shared';
import { prisma } from '../db';
import { lockRoom } from '../chatRooms/roomLock';
import { conflict } from '../common/errors';

export const DEFAULT_CHAT_SETTINGS: ChatSettingsDTO = {
  translationProvider: 'external', translationEnabled: true, aiEnabled: true, revision: 0
};

export async function getChatSettings(db: Prisma.TransactionClient = prisma): Promise<ChatSettingsDTO> {
  const row = await db.chatSettings.findUnique({ where: { id: 1 } });
  return row ? { translationProvider: row.translationProvider as ChatSettingsDTO['translationProvider'],
    translationEnabled: row.translationEnabled, aiEnabled: row.aiEnabled, revision: row.revision } : { ...DEFAULT_CHAT_SETTINGS };
}

/** 상담 생성과 공용 설정 변경의 순서를 보장한다. 모델 호출 중에는 잡지 않는다. */
export async function lockChatConfiguration(tx: Prisma.TransactionClient): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(736201)`;
}

export async function saveChatSettings(input: ChatSettingsDTO) {
  return prisma.$transaction(async tx => {
    await lockChatConfiguration(tx);
    await tx.chatSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
    const changed = await tx.chatSettings.updateMany({ where: { id: 1, revision: input.revision },
      data: { translationProvider: input.translationProvider, translationEnabled: input.translationEnabled,
        aiEnabled: input.aiEnabled, revision: { increment: 1 } } });
    if (!changed.count) throw conflict('SETTINGS_CHANGED', '다른 운영자가 설정을 변경했습니다. 새로고침 후 다시 저장해주세요.');
    // AI를 다시 켜도 이미 인계된 방은 bot으로 되돌리지 않는다.
    const rooms = !input.aiEnabled ? await tx.chatRoom.findMany({ where: { status: 'bot' }, orderBy: { id: 'asc' }, select: { id: true, assignedOperatorId: true } }) : [];
    const changedRooms = [];
    for (const candidate of rooms) {
      const room = await lockRoom(tx, candidate.id);
      if (room.status !== 'bot') continue;
      await tx.chatRoom.update({ where: { id: room.id }, data: { status: 'waiting' } });
      changedRooms.push({ id: room.id, assignedOperatorId: room.assignedOperatorId });
    }
    return { settings: await getChatSettings(tx), rooms: changedRooms };
  });
}
