import type { OperatorNoteDTO } from '@stemcare/shared';
import { notFound } from '../common/errors';
import { prisma } from '../db';

export async function createNote(
  roomId: string,
  operatorId: string,
  note: string
): Promise<OperatorNoteDTO> {
  const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
  if (!room) throw notFound('상담방을 찾을 수 없습니다.');

  const created = await prisma.operatorNote.create({
    data: { chatRoomId: roomId, operatorId, note: note.trim() },
    include: { operator: true }
  });

  return {
    id: created.id,
    operatorId: created.operatorId,
    operatorName: created.operator.name,
    note: created.note,
    createdAt: created.createdAt.toISOString()
  };
}
