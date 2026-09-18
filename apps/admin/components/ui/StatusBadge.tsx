import type { ChatRoomStatus } from '@stemcare/shared';
import { statusLabel } from '@/lib/labels';

const COLORS: Record<ChatRoomStatus, { bg: string; fg: string }> = {
  bot: { bg: '#e7edf8', fg: '#2b4f88' },
  waiting: { bg: '#fbf0da', fg: '#8a5f10' },
  active: { bg: '#e2f4e9', fg: '#1d6b41' },
  closed: { bg: '#eceff3', fg: '#5d6b7f' }
};

export function StatusBadge({ status }: { status: ChatRoomStatus }) {
  const color = COLORS[status];

  return (
    <span
      style={{
        display: 'inline-block',
        background: color.bg,
        color: color.fg,
        borderRadius: 4,
        padding: '1px 6px',
        fontSize: 11,
        lineHeight: '16px',
        whiteSpace: 'nowrap'
      }}
    >
      {statusLabel(status)}
    </span>
  );
}
