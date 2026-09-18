'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { OperatorDTO } from '@stemcare/shared';
import * as api from '@/lib/api';
import { closeSocket } from '@/lib/socket';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthValue {
  operator: OperatorDTO | null;
  error: string | null;
  status: AuthStatus;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** 어떤 요청이든 401 을 받으면 이걸 불러 로그인 화면으로 되돌린다. */
  markSignedOut: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [operator, setOperator] = useState<OperatorDTO | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const [error, setError] = useState<string | null>(null);
  const revision = useRef(0);

  useEffect(() => api.subscribeUnauthorized(() => {
    revision.current += 1;
    closeSocket();
    setOperator(null); setStatus('anonymous');
  }), []);

  // 새로고침해도 쿠키가 살아 있으면 로그인 상태를 복원한다.
  useEffect(() => {
    let cancelled = false;
    const version = revision.current;

    api
      .fetchMe()
      .then((me) => {
        if (cancelled || version !== revision.current) return;
        setOperator(me);
        setStatus('authenticated');
      })
      .catch(() => {
        if (cancelled || version !== revision.current) return;
        setOperator(null);
        setStatus('anonymous');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const version = ++revision.current;
    setError(null);
    const me = await api.login(email, password);
    if (version !== revision.current) return;
    setOperator(me);
    setStatus('authenticated');
  }, []);

  const signOut = useCallback(async () => {
    revision.current += 1;
    try {
      await api.logout();
      // 로그아웃 후에도 소켓이 살아 있으면, 서버가 아직 이 소켓을 운영자로 인식해
      // 남의 상담 이벤트를 계속 이 브라우저로 보낸다.
      closeSocket();
      setOperator(null); setStatus('anonymous'); setError(null);
    } catch {
      setError('로그아웃하지 못했습니다. 연결을 확인하고 다시 시도해주세요.');
    }
  }, []);

  const markSignedOut = useCallback(() => {
    revision.current += 1;
    closeSocket();
    setOperator(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo(
    () => ({ operator, status, error, signIn, signOut, markSignedOut }),
    [operator, status, error, signIn, signOut, markSignedOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth 는 AuthProvider 안에서만 쓸 수 있습니다.');
  return value;
}
