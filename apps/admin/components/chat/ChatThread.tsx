'use client';

import { useState } from 'react';
import type { MessageDTO } from '@stemcare/shared';
import { useMessageScroller } from '@/hooks/useMessageScroller';
import { MessageBubble } from './MessageBubble';
import { SystemMarker } from './SystemMarker';

export function ChatThread({
  messages,
  roomId,
  onRetranslate,
  translationEnabled = true
}: {
  messages: MessageDTO[];
  roomId: string;
  translationEnabled?: boolean;
  onRetranslate?: (messageId: string) => void;
}) {
  const [view, setView] = useState<'both' | 'original' | 'translated'>('both');
  const { scrollRef, hasNewBelow, newCount, scrollToBottom, onScroll } = useMessageScroller({
    itemCount: messages.length,
    roomId
  });

  return (
    <div style={{ position: 'relative', flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <label style={{ padding: '6px 18px', fontSize: 12 }}>대화 표시
        <select aria-label="대화 표시" value={view} onChange={e => setView(e.target.value as typeof view)} style={{ width: 'auto', marginLeft: 8 }}>
          <option value="both">원문 + 번역</option><option value="original">원문만</option><option value="translated">번역 우선</option>
        </select>
      </label>
      <div
        data-testid="chat-thread"
        ref={scrollRef}
        onScroll={onScroll}
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          overflowY: 'auto',
          overflowAnchor: 'none',
          overscrollBehavior: 'contain',
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}
      >
        {messages.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 'auto' }}>
            아직 메시지가 없습니다.
          </p>
        )}

        {messages.map((message) =>
          message.senderType === 'system' ? (
            <SystemMarker key={message.id} text={message.visibleText} time={message.createdAt} />
          ) : (
            <MessageBubble key={message.id} message={message} onRetranslate={translationEnabled ? onRetranslate : undefined} view={view} />
          )
        )}
      </div>

      {hasNewBelow && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 12,
            transform: 'translateX(-50%)',
            border: 'none',
            borderRadius: 999,
            padding: '5px 14px',
            fontSize: 12,
            background: 'var(--accent)',
            color: '#fff',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.18)'
          }}
        >
          새 메시지 {newCount}개 ↓
        </button>
      )}
    </div>
  );
}
