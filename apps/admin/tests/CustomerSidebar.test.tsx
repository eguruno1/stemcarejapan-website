import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CustomerSidebar } from '@/components/chat/CustomerSidebar';
import { fetchCustomerHistory } from '@/lib/api';
import type { ChatRoomDetail } from '@stemcare/shared';

vi.mock('@/lib/api', () => ({
  assignRoom: vi.fn(),
  changeStatus: vi.fn(),
  createNote: vi.fn(),
  fetchCustomerHistory: vi.fn()
}));

function makeRoom(overrides: Partial<ChatRoomDetail> = {}): ChatRoomDetail {
  return {
    id: 'room-1',
    status: 'waiting',
    serviceType: 'stemcell',
    assignedOperatorId: null,
    createdAt: new Date().toISOString(),
    customer: { name: '고객', phone: '12345', preferredLanguage: 'ja' },
    notes: [],
    summary: null,
    ...overrides
  } as unknown as ChatRoomDetail;
}

describe('CustomerSidebar AI 요약', () => {
  it('riskFlags 를 태그 형태로 각각 보여준다', () => {
    vi.mocked(fetchCustomerHistory).mockResolvedValue([]);
    const room = makeRoom({
      summary: {
        id: 's1',
        summary: '일본 고객이 비용을 문의함.',
        customerNeeds: null,
        nextAction: '담당자가 비용 안내',
        riskFlags: ['가격문의', '예약요청'],
        createdAt: new Date().toISOString()
      }
    });

    render(<CustomerSidebar room={room} onChanged={vi.fn()} onNoteCreated={vi.fn()} />);

    expect(screen.getByText('가격문의')).toBeInTheDocument();
    expect(screen.getByText('예약요청')).toBeInTheDocument();
  });

  it('요약이 없으면 안내 문구를 보여준다', () => {
    vi.mocked(fetchCustomerHistory).mockResolvedValue([]);
    const room = makeRoom({ summary: null });

    render(<CustomerSidebar room={room} onChanged={vi.fn()} onNoteCreated={vi.fn()} />);

    expect(screen.getByText(/아직 요약이 없습니다/)).toBeInTheDocument();
  });
});
