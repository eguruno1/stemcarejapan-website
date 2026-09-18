import type { ChatRoom, Customer, Message, Operator } from '@prisma/client';
import type { ChatRoomListItem, ChatRoomStatus, CustomerDTO, Language, ServiceType } from '@stemcare/shared';

export type RoomWithRelations = ChatRoom & {
  customer: Customer;
  assignedOperator: Operator | null;
  messages: Message[];
};

export function toCustomerDTO(row: Customer): CustomerDTO {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    preferredLanguage: row.preferredLanguage as Language,
    serviceType: row.serviceType as ServiceType,
    createdAt: row.createdAt.toISOString()
  };
}

export function toChatRoomListItem(row: RoomWithRelations, unreadCount: number): ChatRoomListItem {
  const lastMessage = row.messages[0] ?? null;

  return {
    id: row.id,
    customerName: row.customer.name,
    preferredLanguage: row.customer.preferredLanguage as Language,
    serviceType: row.serviceType as ServiceType,
    status: row.status as ChatRoomStatus,
    assignedOperatorId: row.assignedOperatorId,
    assignedOperatorName: row.assignedOperator?.name ?? null,
    // 목록에는 긴 본문을 다 보내지 않는다. 60자면 충분하다.
    lastMessagePreview: lastMessage ? lastMessage.visibleText.slice(0, 60) : null,
    lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
    unreadCount,
    createdAt: row.createdAt.toISOString()
  };
}
