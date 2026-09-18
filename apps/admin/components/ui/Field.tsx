'use client';

import { useId, type ReactNode } from 'react';

/**
 * children 을 함수로 받는 이유는 useId() 가 만든 id 를 label 과 input 이
 * 같이 써야 하기 때문이다. 그래야 label 클릭 시 포커스가 이동하고
 * 스크린리더가 올바르게 읽는다.
 */
export function Field({
  label,
  error,
  hint,
  children
}: {
  label: string;
  error?: string | null;
  hint?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();

  return (
    <div style={{ display: 'grid', gap: 4, marginBottom: 14 }}>
      <label htmlFor={id} style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        {label}
      </label>
      {children(id)}
      {hint && !error && <small style={{ color: 'var(--text-muted)' }}>{hint}</small>}
      {error && (
        <small role="alert" style={{ color: 'var(--danger)' }}>
          {error}
        </small>
      )}
    </div>
  );
}
