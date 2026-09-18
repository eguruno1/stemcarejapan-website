import type { ChatRoom } from '@prisma/client';
import type { ChatRoomStatus, StartChatRequest, StartChatResponse } from '@stemcare/shared';
import { conflict, forbidden, notFound, unauthorized } from '../common/errors';
import { prisma } from '../db';
import { createVisitorToken, hashVisitorToken } from '../auth/token';
import { createMessage } from '../messages/messageService';

export async function startChat(input: StartChatRequest): Promise<StartChatResponse> {
  const visitorToken = createVisitorToken();

  const { customer, room } = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: {
        name: input.name.trim(),
        phone: input.phone.trim(),
        email: input.email?.trim() || null,
        preferredLanguage: input.preferredLanguage,
        serviceType: input.serviceType,
        privacyAgreedAt: new Date()
      }
    });

    const room = await tx.chatRoom.create({
      data: {
        customerId: customer.id,
        serviceType: input.serviceType,
        status: 'bot',
        sourcePage: input.sourcePage ?? null,
        visitorTokenHash: hashVisitorToken(visitorToken)
      }
    });

    return { customer, room };
  });

  const firstMessage = input.message?.trim();
  if (firstMessage) {
    await createMessage({
      chatRoomId: room.id,
      senderType: 'customer',
      senderId: customer.id,
      text: firstMessage,
      // 언어 감지는 Phase 5 에서 붙인다. 지금은 고객이 고른 언어를 그대로 쓴다.
      originalLanguage: input.preferredLanguage,
      viewer: 'customer'
    });
  }

  return {
    roomId: room.id,
    customerId: customer.id,
    visitorToken,
    status: room.status as ChatRoomStatus
  };
}

/** 고객 요청에서 상담방 소유권을 확인한다. 통과하면 상담방 row 를 돌려준다. */
export async function authorizeVisitor(roomId: string, visitorToken: string | undefined): Promise<ChatRoom> {
  if (!visitorToken) {
    throw unauthorized('상담방 접근 토큰이 없습니다.');
  }

  const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
  if (!room) {
    throw notFound('상담방을 찾을 수 없습니다.');
  }

  if (room.visitorTokenHash !== hashVisitorToken(visitorToken)) {
    throw forbidden('이 상담방에 접근할 권한이 없습니다.');
  }

  return room;
}

export function assertRoomOpen(room: ChatRoom): void {
  if (room.status === 'closed') {
    throw conflict('ROOM_CLOSED', '종료된 상담입니다. 새 상담을 시작해주세요.');
  }
}
