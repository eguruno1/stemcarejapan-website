import type {
  ChatRoomStatus,
  DetectedLanguage,
  Language,
  MessageType,
  OperatorRole,
  SenderType,
  ServiceType,
  TranslationStatus
} from './constants';

/** POST /api/public/chat/start 요청 본문 */
export interface StartChatRequest {
  name: string;
  phone: string;
  email?: string;
  preferredLanguage: Language;
  serviceType: ServiceType;
  sourcePage?: string;
  message?: string;
  privacyAgreed: boolean;
}

/** POST /api/public/chat/start 응답 본문 */
export interface StartChatResponse {
  roomId: string;
  customerId: string;
  visitorToken: string;
  status: ChatRoomStatus;
}

/** 화면에 뿌리는 메시지 한 건 */
export interface MessageDTO {
  id: string;
  chatRoomId: string;
  senderType: SenderType;
  senderId: string | null;
  messageType: MessageType;
  originalLanguage: DetectedLanguage;
  originalText: string;
  translatedLanguage: Language | null;
  translatedText: string | null;
  visibleText: string;
  translationStatus: TranslationStatus;
  clientMessageId: string | null;
  createdAt: string;
}

/** 운영자 상담 목록의 한 줄 */
export interface ChatRoomListItem {
  id: string;
  customerName: string;
  preferredLanguage: Language;
  serviceType: ServiceType;
  status: ChatRoomStatus;
  assignedOperatorId: string | null;
  assignedOperatorName: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  createdAt: string;
}

export interface CustomerDTO {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  preferredLanguage: Language;
  serviceType: ServiceType;
  createdAt: string;
}

export interface ChatSummaryDTO {
  id: string;
  summary: string;
  customerNeeds: string | null;
  nextAction: string | null;
  riskFlags: string[];
  createdAt: string;
}

export interface OperatorNoteDTO {
  id: string;
  operatorId: string;
  operatorName: string;
  note: string;
  createdAt: string;
}

/** 운영자 상담 상세 화면이 한 번에 받는 묶음 */
export interface ChatRoomDetail {
  id: string;
  status: ChatRoomStatus;
  serviceType: ServiceType;
  sourcePage: string | null;
  assignedOperatorId: string | null;
  createdAt: string;
  closedAt: string | null;
  customer: CustomerDTO;
  messages: MessageDTO[];
  summary: ChatSummaryDTO | null;
  notes: OperatorNoteDTO[];
}

export interface OperatorDTO {
  id: string;
  name: string;
  email: string;
  role: OperatorRole;
  isActive: boolean;
}

/** 서버가 실패를 알릴 때 항상 이 모양으로 응답한다 */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** 오른쪽 패널에 보여줄 이 고객의 지난 상담 한 건 */
export interface CustomerHistoryItem {
  roomId: string;
  status: ChatRoomStatus;
  serviceType: ServiceType;
  startedAt: string;
  closedAt: string | null;
  messageCount: number;
}

export interface OpsMetrics {
  waitingRooms: number;
  activeRooms: number;
  botRooms: number;
  todayStarted: number;
  /** 고객 마지막 메시지 이후 10분 넘게 응답이 없는 상담 수 */
  unansweredOver10Min: number;
  translationFailures24h: number;
  socketConnections: number;
  dbOk: boolean;
}
