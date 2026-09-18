'use client';

import type { ButtonHTMLAttributes, CSSProperties } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const STYLES: Record<Variant, CSSProperties> = {
  primary: { background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' },
  secondary: { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' },
  danger: { background: 'var(--danger)', color: '#fff', border: '1px solid var(--danger)' },
  ghost: { background: 'transparent', color: 'var(--text-muted)', border: '1px solid transparent' }
};

export function Button({
  variant = 'secondary',
  style,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...rest}
      style={{
        ...STYLES[variant],
        borderRadius: 6,
        padding: '7px 12px',
        fontSize: 13,
        cursor: rest.disabled ? 'not-allowed' : 'pointer',
        opacity: rest.disabled ? 0.55 : 1,
        ...style
      }}
    />
  );
}
