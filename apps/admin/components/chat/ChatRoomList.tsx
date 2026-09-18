'use client';

import { useParams } from 'next/navigation';
import { STATUS_FILTERS } from '@/lib/labels';
import { useRoomList } from '@/hooks/useRoomList';
import { ChatRoomListItem } from './ChatRoomListItem';

export function ChatRoomList() {
  const params = useParams<{ roomId?: string }>();
  const activeRoomId = params?.roomId;
  const { rooms, loading, error, filter, setFilter, sort, setSort } = useRoomList();

  return (
    <>
      <div style={{ padding: 10, borderBottom: '1px solid var(--border)', flex: 'none' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {STATUS_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              aria-pressed={filter === option.value}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 999,
                padding: '3px 9px',
                fontSize: 11,
                cursor: 'pointer',
                background: filter === option.value ? 'var(--accent)' : 'var(--surface)',
                color: filter === option.value ? '#fff' : 'var(--text-muted)'
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          aria-label="정렬"
          style={{ fontSize: 12, padding: '4px 6px' }}
        >
          <option value="recent">최근 메시지순</option>
          <option value="oldest_waiting">오래 기다린 순</option>
        </select>
      </div>

      <div style={{ flex: '1 1 auto', overflowY: 'auto', minHeight: 0 }}>
        {loading && rooms.length === 0 && (
          <p style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>불러오는 중…</p>
        )}

        {error && (
          <p role="alert" style={{ padding: 16, fontSize: 12, color: 'var(--danger)' }}>
            {error}
          </p>
        )}

        {!loading && rooms.length === 0 && !error && (
          <p style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>
            해당 조건의 상담이 없습니다.
          </p>
        )}

        {rooms.map((room) => (
          <ChatRoomListItem key={room.id} room={room} active={room.id === activeRoomId} />
        ))}
      </div>
    </>
  );
}
