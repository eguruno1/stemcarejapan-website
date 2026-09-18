export const LANGUAGES = ['ko', 'ja'] as const;
export type Language = (typeof LANGUAGES)[number];

/** 언어 감지에 실패했을 때 저장하는 값까지 포함한 확장 타입 */
export const DETECTED_LANGUAGES = ['ko', 'ja', 'unknown'] as const;
export type DetectedLanguage = (typeof DETECTED_LANGUAGES)[number];

export const SERVICE_TYPES = ['stemcell', 'korea_travel', 'undecided'] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const CHAT_ROOM_STATUSES = ['bot', 'waiting', 'active', 'closed'] as const;
export type ChatRoomStatus = (typeof CHAT_ROOM_STATUSES)[number];

export const SENDER_TYPES = ['customer', 'operator', 'ai', 'system'] as const;
export type SenderType = (typeof SENDER_TYPES)[number];

export const MESSAGE_TYPES = ['text', 'image', 'file', 'system'] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export const TRANSLATION_STATUSES = ['none', 'pending', 'done', 'failed', 'edited'] as const;
export type TranslationStatus = (typeof TRANSLATION_STATUSES)[number];

export const OPERATOR_ROLES = ['admin', 'operator'] as const;
export type OperatorRole = (typeof OPERATOR_ROLES)[number];
