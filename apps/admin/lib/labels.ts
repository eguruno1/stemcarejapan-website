import type { ChatRoomStatus, Language, SenderType, ServiceType } from '@stemcare/shared';

const STATUS_LABELS: Record<ChatRoomStatus, string> = {
  bot: 'AI 상담 중',
  waiting: '운영자 대기',
  active: '진행 중',
  closed: '완료'
};

const SERVICE_LABELS: Record<ServiceType, string> = {
  stemcell: '줄기세포',
  korea_travel: '한국 관광',
  undecided: '미정'
};

const LANGUAGE_LABELS: Record<Language, string> = {
  ko: '한국어',
  ja: '일본어'
};

const SENDER_LABELS: Record<SenderType, string> = {
  customer: '고객',
  operator: '운영자',
  ai: 'AI',
  system: '시스템'
};

export const statusLabel = (status: ChatRoomStatus) => STATUS_LABELS[status];
export const serviceLabel = (service: ServiceType) => SERVICE_LABELS[service];
export const languageLabel = (lang: Language) => LANGUAGE_LABELS[lang];
export const senderLabel = (sender: SenderType) => SENDER_LABELS[sender];

/** 필터 버튼에 쓸 목록. 순서가 화면 순서다. */
export const STATUS_FILTERS: Array<{ value: ChatRoomStatus | 'all'; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'waiting', label: '운영자 대기' },
  { value: 'active', label: '진행 중' },
  { value: 'bot', label: 'AI 상담 중' },
  { value: 'closed', label: '완료' }
];
