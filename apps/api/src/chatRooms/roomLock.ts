import type { Prisma } from '@prisma/client';
import { notFound } from '../common/errors';

/** 모든 방 쓰기는 같은 행 잠금을 사용해 상태 확인과 저장 사이의 경쟁을 막는다. */
export async function lockRoom(tx: Prisma.TransactionClient, roomId: string) {
  await tx.$queryRaw`SELECT id FROM chat_rooms WHERE id = ${roomId} FOR UPDATE`;
  const room = await tx.chatRoom.findUnique({ where: { id: roomId } });
  if (!room) throw notFound('상담방을 찾을 수 없습니다.');
  return room;
}
