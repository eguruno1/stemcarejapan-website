'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { OperatorDTO } from '@stemcare/shared';
import * as api from '@/lib/api';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthValue {
  operator: OperatorDTO | null;
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

  // 새로고침해도 쿠키가 살아 있으면 로그인 상태를 복원한다.
  useEffect(() => {
    let cancelled = false;

    api
      .fetchMe()
      .then((me) => {
        if (cancelled) return;
        setOperator(me);
        setStatus('authenticated');
      })
      .catch(() => {
        if (cancelled) return;
        setOperator(null);
        setStatus('anonymous');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const me = await api.login(email, password);
    setOperator(me);
    setStatus('authenticated');
  }, []);

  const signOut = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setOperator(null);
    setStatus('anonymous');
  }, []);

  const markSignedOut = useCallback(() => {
    setOperator(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo(
    () => ({ operator, status, signIn, signOut, markSignedOut }),
    [operator, status, signIn, signOut, markSignedOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth 는 AuthProvider 안에서만 쓸 수 있습니다.');
  return value;
}
