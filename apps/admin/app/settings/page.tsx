'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/Button';

export default function SettingsPage() {
  const router = useRouter();
  const { operator, status, signOut, error } = useAuth();

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
  }, [status, router]);

  if (status !== 'authenticated' || !operator) {
    return (
      <main style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <p style={{ color: 'var(--text-muted)' }}>확인 중…</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 520, padding: 24 }}>
      <h1 style={{ fontSize: 18, margin: '0 0 18px' }}>운영자 설정</h1>

      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: '100px 1fr',
          gap: '10px 14px',
          fontSize: 13
        }}
      >
        <dt style={{ color: 'var(--text-muted)' }}>이름</dt>
        <dd style={{ margin: 0 }}>{operator.name}</dd>
        <dt style={{ color: 'var(--text-muted)' }}>이메일</dt>
        <dd style={{ margin: 0 }}>{operator.email}</dd>
        <dt style={{ color: 'var(--text-muted)' }}>권한</dt>
        <dd style={{ margin: 0 }}>{operator.role === 'admin' ? '관리자' : '운영자'}</dd>
      </dl>

      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 18 }}>
        비밀번호 변경과 운영자 추가는 아직 화면으로 제공하지 않습니다. 시드 스크립트나 DB 작업으로
        처리합니다.
      </p>

      {error && <p role="alert">{error}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
        <Button variant="secondary" onClick={() => router.push('/chats')}>
          상담 목록
        </Button>
        <Button variant="danger" onClick={() => void signOut()}>
          로그아웃
        </Button>
      </div>
    </main>
  );
}
