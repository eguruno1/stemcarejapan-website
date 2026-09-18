'use client';

import Link from 'next/link';
import type { ChatRoomListItem as RoomItem } from '@stemcare/shared';
import { formatRelative } from '@/lib/format';
import { languageLabel, serviceLabel } from '@/lib/labels';
import { StatusBadge } from '@/components/ui/StatusBadge';

export function ChatRoomListItem({ room, active }: { room: RoomItem; active: boolean }) {
  return (
    <Link
      href={`/chats/${room.id}`}
      style={{
        display: 'block',
        padding: '10px 12px',
        borderBottom: '1px solid var(--border)',
        background: active ? '#eaf1fb' : 'transparent',
        color: 'inherit',
        textDecoration: 'none'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <strong
          style={{
            fontSize: 13,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {room.customerName}
        </strong>
        {room.unreadCount > 0 && (
          <span
            aria-label={`읽지 않은 메시지 ${room.unreadCount}개`}
            style={{
              flex: 'none',
              background: 'var(--danger)',
              color: '#fff',
              borderRadius: 999,
              fontSize: 10,
              padding: '0 6px',
              lineHeight: '16px'
            }}
          >
            {room.unreadCount}
          </span>
        )}
        <span
          style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', flex: 'none' }}
        >
          {formatRelative(room.lastMessageAt)}
        </span>
      </div>

      <p
        style={{
          margin: '4px 0 6px',
          fontSize: 12,
          color: 'var(--text-muted)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {room.lastMessagePreview ?? '아직 메시지가 없습니다.'}
      </p>

      <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
        <StatusBadge status={room.status} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {serviceLabel(room.serviceType)} · {languageLabel(room.preferredLanguage)}
        </span>
        {room.assignedOperatorName && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            · {room.assignedOperatorName}
          </span>
        )}
      </div>
    </Link>
  );
}
