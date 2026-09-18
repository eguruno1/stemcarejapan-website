'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { AdminApiError } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const { status, signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 이미 로그인돼 있으면 상담 목록으로 보낸다.
  useEffect(() => {
    if (status === 'authenticated') router.replace('/chats');
  }, [status, router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await signIn(email.trim(), password);
      router.replace('/chats');
    } catch (err) {
      if (err instanceof AdminApiError) {
        if (err.code === 'INVALID_CREDENTIALS') {
          setError('이메일 또는 비밀번호가 올바르지 않습니다.');
        } else if (err.code === 'OPERATOR_DISABLED') {
          setError('비활성화된 계정입니다. 관리자에게 문의하세요.');
        } else if (err.code === 'NETWORK_ERROR') {
          setError('API 서버에 연결할 수 없습니다.');
        } else {
          setError(err.message);
        }
      } else {
        setError('로그인 중 문제가 발생했습니다.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 20 }}>
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 340,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: 24
        }}
      >
        <h1 style={{ fontSize: 17, margin: '0 0 2px' }}>상담 관리자</h1>
        <p style={{ color: 'var(--text-muted)', margin: '0 0 20px', fontSize: 12 }}>
          운영자 계정으로 로그인하세요.
        </p>

        <Field label="이메일">
          {(id) => (
            <input
              id={id}
              type="email"
              value={email}
              autoComplete="username"
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          )}
        </Field>

        <Field label="비밀번호">
          {(id) => (
            <input
              id={id}
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          )}
        </Field>

        {error && (
          <p role="alert" style={{ color: 'var(--danger)', fontSize: 12, margin: '0 0 12px' }}>
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" disabled={submitting} style={{ width: '100%' }}>
          {submitting ? '로그인 중…' : '로그인'}
        </Button>
      </form>
    </main>
  );
}
