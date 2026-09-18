'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/Button';

export default function ChatsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { operator, status, signOut } = useAuth();

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
  }, [status, router]);

  // 인증 확인 전에는 개인정보가 담긴 화면을 절대 그리지 않는다.
  if (status !== 'authenticated' || !operator) {
    return (
      <main style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <p style={{ color: 'var(--text-muted)' }}>확인 중…</p>
      </main>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header
        style={{
          height: 'var(--header-h)',
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)'
        }}
      >
        <strong style={{ fontSize: 13 }}>StemCareJapan 상담 관리자</strong>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
          {operator.name} · {operator.role === 'admin' ? '관리자' : '운영자'}
        </span>
        <Button variant="ghost" onClick={() => void signOut()}>
          로그아웃
        </Button>
      </header>

      {/*
        minHeight: 0 / minWidth: 0 이 없으면 flex 아이템이 내용 크기만큼 커져서
        안쪽 스크롤 영역이 동작하지 않고 페이지 전체가 늘어난다.
        채팅 화면에서 가장 흔한 레이아웃 버그다.
      */}
      <div style={{ display: 'flex', flex: '1 1 auto', minHeight: 0 }}>
        <aside
          style={{
            width: 'var(--sidebar-w)',
            flex: 'none',
            borderRight: '1px solid var(--border)',
            background: 'var(--surface)',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0
          }}
        >
          <p style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>상담 목록 준비 중…</p>
        </aside>

        <main style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', minHeight: 0 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
