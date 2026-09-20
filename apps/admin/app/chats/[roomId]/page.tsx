'use client';

import { use, useCallback } from 'react';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { ChatThread } from '@/components/chat/ChatThread';
import { CustomerSidebar } from '@/components/chat/CustomerSidebar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useRoomStream } from '@/hooks/useRoomStream';
import { retranslate } from '@/lib/api';

export default function ChatRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  // Next.js 15 에서 params 는 Promise 다. use() 로 풀어 쓴다.
  const { roomId } = use(params);
  const { room, loading, error, realtime, peerTyping, applyRoom, appendMessage, appendNote } = useRoomStream(roomId);

  const handleRetranslate = useCallback(
    (messageId: string) => {
      void retranslate(roomId, messageId).then(appendMessage).catch(() => {
        // 실패해도 메시지는 translationStatus:'failed' 그대로 남는다 - 버튼으로 다시 시도할 수 있다.
      });
    },
    [roomId, appendMessage]
  );

  if (loading && !room) {
    return (
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--text-muted)' }}>
        불러오는 중…
      </div>
    );
  }

  if (error && !room) {
    return (
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--danger)' }}>
        {error}
      </div>
    );
  }

  if (!room) return null;

  return (
    <div style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0 }}>
      <section
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: '1 1 auto',
          minWidth: 0,
          minHeight: 0
        }}
      >
        <header
          style={{
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 18px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)'
          }}
        >
          <strong style={{ fontSize: 13 }}>{room.customer.name}</strong>
          <StatusBadge status={room.status} />
          {peerTyping && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>고객이 입력 중…</span>
          )}
          {error ? (
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--danger)' }}>
              연결 불안정 · 재시도 중
            </span>
          ) : (
            <span
              style={{ marginLeft: 'auto', fontSize: 11, color: realtime ? '#1a7f37' : '#c07a2b' }}
            >
              {realtime ? '실시간 연결됨' : '재연결 중 · 주기 조회로 동작'}
            </span>
          )}
        </header>

        <ChatThread messages={room.messages} roomId={room.id} onRetranslate={handleRetranslate} translationEnabled={room.translationEnabled} />

        <ChatComposer
          key={room.id}
          roomId={room.id}
          disabled={room.status === 'closed'}
          customerLanguage={room.customer.preferredLanguage}
          translationEnabled={room.translationEnabled}
          onSent={appendMessage}
        />
      </section>

      <CustomerSidebar key={room.id} room={room} onChanged={applyRoom} onNoteCreated={appendNote} />
    </div>
  );
}
