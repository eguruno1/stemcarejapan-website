'use client';

import type { MessageDTO } from '@stemcare/shared';
import { useMessageScroller } from '@/hooks/useMessageScroller';
import { MessageBubble } from './MessageBubble';
import { SystemMarker } from './SystemMarker';

export function ChatThread({ messages, roomId }: { messages: MessageDTO[]; roomId: string }) {
  const { scrollRef, hasNewBelow, newCount, scrollToBottom, onScroll } = useMessageScroller({
    itemCount: messages.length,
    roomId
  });

  return (
    <div style={{ position: 'relative', flex: '1 1 auto', minHeight: 0 }}>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        style={{
          height: '100%',
          overflowY: 'auto',
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
            <MessageBubble key={message.id} message={message} />
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
