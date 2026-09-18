import { render, screen } from '@testing-library/react';
import type { ChatRoomListItem as RoomItem } from '@stemcare/shared';
import { describe, expect, it, vi } from 'vitest';
import { ChatRoomListItem } from '@/components/chat/ChatRoomListItem';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
}));

const baseRoom: RoomItem = {
  id: 'room-1',
  customerName: '야마다 타로',
  preferredLanguage: 'ja',
  serviceType: 'korea_travel',
  status: 'waiting',
  assignedOperatorId: null,
  assignedOperatorName: null,
  lastMessagePreview: '来月2人で韓国に行きたいです。',
  lastMessageAt: new Date().toISOString(),
  unreadCount: 3,
  createdAt: new Date().toISOString()
};

describe('ChatRoomListItem', () => {
  it('고객 이름, 상태, 서비스, 언어를 보여준다', () => {
    render(<ChatRoomListItem room={baseRoom} active={false} />);

    expect(screen.getByText('야마다 타로')).toBeInTheDocument();
    expect(screen.getByText('운영자 대기')).toBeInTheDocument();
    expect(screen.getByText(/한국 관광/)).toBeInTheDocument();
    expect(screen.getByText(/일본어/)).toBeInTheDocument();
  });

  it('읽지 않은 메시지 수를 배지로 보여준다', () => {
    render(<ChatRoomListItem room={baseRoom} active={false} />);

    expect(screen.getByLabelText('읽지 않은 메시지 3개')).toHaveTextContent('3');
  });

  it('읽지 않은 메시지가 없으면 배지를 감춘다', () => {
    render(<ChatRoomListItem room={{ ...baseRoom, unreadCount: 0 }} active={false} />);

    expect(screen.queryByLabelText(/읽지 않은 메시지/)).not.toBeInTheDocument();
  });

  it('메시지가 없으면 안내 문구를 보여준다', () => {
    render(
      <ChatRoomListItem
        room={{ ...baseRoom, lastMessagePreview: null, lastMessageAt: null }}
        active={false}
      />
    );

    expect(screen.getByText('아직 메시지가 없습니다.')).toBeInTheDocument();
  });

  it('담당 운영자가 있으면 이름을 보여준다', () => {
    render(
      <ChatRoomListItem
        room={{ ...baseRoom, assignedOperatorId: 'op-1', assignedOperatorName: '김상담' }}
        active={false}
      />
    );

    expect(screen.getByText(/김상담/)).toBeInTheDocument();
  });
});
