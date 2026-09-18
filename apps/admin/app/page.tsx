'use client';

import { useEffect, useState } from 'react';
import { API_URL } from '@/lib/env';

type HealthState =
  | { kind: 'loading' }
  | { kind: 'ok'; service: string }
  | { kind: 'error'; message: string };

export default function HomePage() {
  const [health, setHealth] = useState<HealthState>({ kind: 'loading' });

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((body) => setHealth({ kind: 'ok', service: body.service }))
      .catch((err: Error) => setHealth({ kind: 'error', message: err.message }));
  }, []);

  return (
    <main style={{ maxWidth: 560, margin: '80px auto', padding: '0 20px' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>StemCareJapan 상담 관리자</h1>
      <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>Phase 0 · 환경 확인 화면</p>

      <section
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: 16,
          marginTop: 24
        }}
      >
        <h2 style={{ fontSize: 14, margin: '0 0 8px' }}>API 서버 연결 상태</h2>
        {health.kind === 'loading' && <p>확인 중…</p>}
        {health.kind === 'ok' && <p style={{ color: '#1a7f37' }}>정상 · {health.service}</p>}
        {health.kind === 'error' && (
          <p style={{ color: 'var(--danger)' }}>
            연결 실패 · {health.message}
            <br />
            <small>API 서버가 켜져 있는지(`npm run dev:api`), CORS 설정이 맞는지 확인하세요.</small>
          </p>
        )}
      </section>
    </main>
  );
}
