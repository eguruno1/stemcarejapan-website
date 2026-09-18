'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ChatRoomDetail, ChatRoomStatus, CustomerHistoryItem } from '@stemcare/shared';
import { assignRoom, changeStatus, createNote, fetchCustomerHistory } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDateTime } from '@/lib/format';
import { languageLabel, serviceLabel } from '@/lib/labels';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 12, padding: '3px 0' }}>
      <span style={{ width: 78, flex: 'none', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ wordBreak: 'break-all' }}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
      <h2 style={{ fontSize: 12, margin: '0 0 8px', color: 'var(--text-muted)' }}>{title}</h2>
      {children}
    </section>
  );
}

export function CustomerSidebar({
  room,
  onChanged
}: {
  room: ChatRoomDetail;
  onChanged: (next: ChatRoomDetail) => void;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<CustomerHistoryItem[] | null>(null);

  // 상담방이 바뀔 때마다 이력을 다시 불러온다.
  // cancelled 플래그가 없으면, 운영자가 방을 빠르게 옮길 때 먼저 보낸 요청의
  // 응답이 늦게 도착해 "이전 고객의 이력"이 현재 화면에 남는다. 개인정보 문제다.
  useEffect(() => {
    let cancelled = false;
    setHistory(null);

    fetchCustomerHistory(room.id)
      .then((items) => {
        if (!cancelled) setHistory(items);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      });

    return () => {
      cancelled = true;
    };
  }, [room.id]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : '처리에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  const nextStatuses: ChatRoomStatus[] =
    room.status === 'closed' ? ['active'] : ['waiting', 'active', 'closed'];

  return (
    <aside
      style={{
        width: 'var(--panel-w)',
        flex: 'none',
        borderLeft: '1px solid var(--border)',
        background: 'var(--surface)',
        overflowY: 'auto'
      }}
    >
      <Section title="상담 상태">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <StatusBadge status={room.status} />
          {room.assignedOperatorId === null && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>미배정</span>
          )}
        </div>

        <Button
          variant="primary"
          disabled={busy}
          style={{ width: '100%', marginBottom: 8 }}
          onClick={() => run(async () => onChanged(await assignRoom(room.id)))}
        >
          내가 상담하기
        </Button>

        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {nextStatuses
            .filter((status) => status !== room.status)
            .map((status) => (
              <Button
                key={status}
                variant={status === 'closed' ? 'danger' : 'secondary'}
                disabled={busy}
                onClick={() => run(async () => onChanged(await changeStatus(room.id, status)))}
              >
                {status === 'closed' ? '상담 종료' : status === 'active' ? '진행 중으로' : '대기로'}
              </Button>
            ))}
        </div>

        {error && (
          <p role="alert" style={{ color: 'var(--danger)', fontSize: 11, marginTop: 8 }}>
            {error}
          </p>
        )}
      </Section>

      <Section title="고객 정보">
        <Row label="이름" value={room.customer.name} />
        <Row label="연락처" value={room.customer.phone} />
        <Row label="이메일" value={room.customer.email ?? '-'} />
        <Row label="선호 언어" value={languageLabel(room.customer.preferredLanguage)} />
        <Row label="희망 서비스" value={serviceLabel(room.serviceType)} />
        <Row label="유입 페이지" value={room.sourcePage ?? '-'} />
        <Row label="상담 시작" value={formatDateTime(room.createdAt)} />
      </Section>

      <Section title={`이전 상담${history && history.length > 0 ? ` (${history.length})` : ''}`}>
        {history === null && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>불러오는 중…</p>
        )}

        {history?.length === 0 && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            이 고객의 첫 상담입니다.
          </p>
        )}

        {history && history.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {history.map((item) => (
              <li
                key={item.roomId}
                style={{ padding: '6px 0', borderTop: '1px solid var(--border)' }}
              >
                <Link
                  href={`/chats/${item.roomId}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    textDecoration: 'none',
                    color: 'inherit'
                  }}
                >
                  <StatusBadge status={item.status} />
                  <span>{serviceLabel(item.serviceType)}</span>
                  <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 11 }}>
                    {formatDateTime(item.startedAt)} · {item.messageCount}건
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="AI 요약">
        {room.summary ? (
          <div style={{ fontSize: 12, lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 6px' }}>{room.summary.summary}</p>
            {room.summary.nextAction && (
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                다음 액션: {room.summary.nextAction}
              </p>
            )}
            {room.summary.riskFlags.length > 0 && (
              <p style={{ margin: '6px 0 0', color: 'var(--danger)' }}>
                주의: {room.summary.riskFlags.join(', ')}
              </p>
            )}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            아직 요약이 없습니다. (Phase 5에서 자동 생성됩니다)
          </p>
        )}
      </Section>

      <Section title="운영자 메모">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          aria-label="운영자 메모"
          placeholder="고객에게 보이지 않는 내부 메모"
          style={{ resize: 'vertical', marginBottom: 6 }}
        />
        <Button
          disabled={busy || note.trim() === ''}
          style={{ width: '100%' }}
          onClick={() =>
            run(async () => {
              const created = await createNote(room.id, note.trim());
              onChanged({ ...room, notes: [created, ...room.notes] });
              setNote('');
            })
          }
        >
          메모 저장
        </Button>

        <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0' }}>
          {room.notes.map((item) => (
            <li
              key={item.id}
              style={{
                fontSize: 12,
                padding: '7px 0',
                borderTop: '1px solid var(--border)',
                lineHeight: 1.5
              }}
            >
              <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 2 }}>
                {item.operatorName} · {formatDateTime(item.createdAt)}
              </div>
              {item.note}
            </li>
          ))}
        </ul>
      </Section>
    </aside>
  );
}
