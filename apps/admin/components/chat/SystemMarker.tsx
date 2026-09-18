import { formatTime } from '@/lib/format';

/** 상담 상태 변화, 운영자 참여 등 사람이 보낸 게 아닌 알림 줄 */
export function SystemMarker({ text, time }: { text: string; time: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 0', flex: 'none' }}>
      <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border)' }} />
      <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        {text} · {formatTime(time)}
      </span>
      <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border)' }} />
    </div>
  );
}
