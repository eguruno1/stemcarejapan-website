'use client';

import { use } from 'react';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { ChatThread } from '@/components/chat/ChatThread';
import { CustomerSidebar } from '@/components/chat/CustomerSidebar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useRoomStream } from '@/hooks/useRoomStream';

export default function ChatRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  // Next.js 15 에서 params 는 Promise 다. use() 로 풀어 쓴다.
  const { roomId } = use(params);
  const { room, loading, error, applyRoom, appendMessage, appendNote } = useRoomStream(roomId);

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
          {error && (
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--danger)' }}>
              연결 불안정 · 재시도 중
            </span>
          )}
        </header>

        <ChatThread messages={room.messages} roomId={room.id} />

        <ChatComposer
          key={room.id}
          roomId={room.id}
          disabled={room.status === 'closed'}
          onSent={appendMessage}
        />
      </section>

      <CustomerSidebar key={room.id} room={room} onChanged={applyRoom} onNoteCreated={appendNote} />
    </div>
  );
}
