'use client';

import { useEffect, useState } from 'react';
import type { OpsMetrics } from '@stemcare/shared';
import { fetchMetrics } from '@/lib/api';

const POLL_INTERVAL_MS = 15_000;

function Tile({
  label,
  value,
  warn
}: {
  label: string;
  value: string | number;
  warn?: boolean;
}) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: `1px solid ${warn ? 'var(--danger)' : 'var(--border)'}`,
        borderRadius: 8,
        padding: 14,
        minWidth: 150
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: warn ? 'var(--danger)' : 'var(--text)' }}>
        {value}
      </div>
    </div>
  );
}

export default function OpsPage() {
  const [metrics, setMetrics] = useState<OpsMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setMetrics(await fetchMetrics());
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : '지표를 불러오지 못했습니다.');
      }
    }

    void load();
    // 탭이 백그라운드에 있을 때는 쉰다 - 다른 화면의 폴링 훅들과 같은 규칙이다.
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
      <h1 style={{ fontSize: 15, margin: '0 0 14px' }}>운영 현황</h1>

      {error && <p style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</p>}

      {metrics && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Tile label="운영자 대기" value={metrics.waitingRooms} warn={metrics.waitingRooms > 3} />
          <Tile label="진행 중" value={metrics.activeRooms} />
          <Tile label="AI 상담 중" value={metrics.botRooms} />
          <Tile label="오늘 접수" value={metrics.todayStarted} />
          <Tile
            label="10분 이상 무응답"
            value={metrics.unansweredOver10Min}
            warn={metrics.unansweredOver10Min > 0}
          />
          <Tile
            label="번역 실패 (24h)"
            value={metrics.translationFailures24h}
            warn={metrics.translationFailures24h > 5}
          />
          <Tile label="실시간 연결" value={metrics.socketConnections} />
          <Tile label="DB" value={metrics.dbOk ? '정상' : '장애'} warn={!metrics.dbOk} />
          <Tile
            label="평균 만족도 (30일)"
            value={
              metrics.avgRating30d === null
                ? '평가 없음'
                : `${metrics.avgRating30d} / 5 (${metrics.feedbackCount30d}건)`
            }
            warn={metrics.avgRating30d !== null && metrics.avgRating30d < 3.5}
          />
        </div>
      )}

      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 16 }}>
        15초마다 자동 갱신됩니다.
      </p>
    </div>
  );
}
