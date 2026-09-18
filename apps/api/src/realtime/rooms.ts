/**
 * 룸 이름은 반드시 이 함수로만 만든다.
 * 문자열을 손으로 조합하면 오타 하나로 브로드캐스트가 조용히 사라진다.
 */
export function roomChannel(roomId: string): string {
  return `room:${roomId}`;
}

/** `room:` 채널 이름에서 roomId 만 꺼낸다. roomChannel() 의 역함수다. */
export function roomIdOf(channel: string): string | null {
  return channel.startsWith('room:') ? channel.slice('room:'.length) : null;
}

/** 로그인한 운영자 전원이 들어가는 방. 신규 상담 알림과 목록 갱신에 쓴다. */
export const OPERATORS_CHANNEL = 'operators';
