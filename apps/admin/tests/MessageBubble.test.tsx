import { render, screen } from '@testing-library/react';
import type { MessageDTO } from '@stemcare/shared';
import { describe, expect, it } from 'vitest';
import { MessageBubble } from '@/components/chat/MessageBubble';

function makeMessage(overrides: Partial<MessageDTO> = {}): MessageDTO {
  return {
    id: 'msg-1',
    chatRoomId: 'room-1',
    senderType: 'customer',
    senderId: 'cust-1',
    messageType: 'text',
    originalLanguage: 'ja',
    originalText: '来月、母と2人で韓国に行きたいです。',
    translatedLanguage: 'ko',
    translatedText: '다음 달에 어머니와 2명이서 한국에 가고 싶습니다.',
    visibleText: '来月、母と2人で韓国に行きたいです。',
    translationStatus: 'done',
    clientMessageId: null,
    createdAt: '2026-09-04T02:30:00.000Z',
    ...overrides
  };
}

describe('MessageBubble (운영자 시점)', () => {
  it('고객 메시지는 원문과 한국어 번역을 함께 보여준다', () => {
    render(<MessageBubble message={makeMessage()} />);

    expect(screen.getByText('来月、母と2人で韓国に行きたいです。')).toBeInTheDocument();
    expect(screen.getByText('다음 달에 어머니와 2명이서 한국에 가고 싶습니다.')).toBeInTheDocument();
  });

  it('번역문이 없으면 원문만 보여준다', () => {
    render(
      <MessageBubble
        message={makeMessage({
          translatedText: null,
          translatedLanguage: null,
          translationStatus: 'none'
        })}
      />
    );

    expect(screen.getByText('来月、母と2人で韓国に行きたいです。')).toBeInTheDocument();
    expect(screen.queryByText(/번역/)).not.toBeInTheDocument();
  });

  it('번역 실패는 안내 문구를 보여준다', () => {
    render(
      <MessageBubble message={makeMessage({ translatedText: null, translationStatus: 'failed' })} />
    );

    expect(screen.getByText(/번역 실패/)).toBeInTheDocument();
  });

  it('번역 대기 중이면 진행 표시를 보여준다', () => {
    render(
      <MessageBubble message={makeMessage({ translatedText: null, translationStatus: 'pending' })} />
    );

    expect(screen.getByText(/번역 중/)).toBeInTheDocument();
  });

  it('운영자가 수정한 번역문은 수정 표시가 붙는다', () => {
    render(
      <MessageBubble message={makeMessage({ senderType: 'operator', translationStatus: 'edited' })} />
    );

    expect(screen.getByText(/직접 수정/)).toBeInTheDocument();
  });

  it('보낸 사람을 라벨로 알려준다', () => {
    render(<MessageBubble message={makeMessage({ senderType: 'ai' })} />);

    expect(screen.getByText(/AI/)).toBeInTheDocument();
  });

  it('시간을 표시한다', () => {
    render(<MessageBubble message={makeMessage()} />);

    // 로케일에 따라 형식이 달라지므로 숫자가 있는지만 확인한다.
    expect(screen.getByTestId('message-time').textContent).toMatch(/\d/);
  });
});
