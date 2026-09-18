'use client';

import type { Language } from '@stemcare/shared';
import { Button } from '@/components/ui/Button';
import { languageLabel } from '@/lib/labels';

/**
 * 전송 전 번역 확인 화면.
 * 운영자는 번역문을 읽고, 어색하면 직접 고친 뒤 보낼 수 있어야 한다.
 */
export function TranslationPreview({
  original,
  originalLanguage,
  translated,
  targetLanguage,
  edited,
  busy,
  disabled = false,
  onTranslatedChange,
  onSend,
  onCancel,
  onRetry,
  error
}: {
  original: string;
  originalLanguage: Language;
  translated: string;
  targetLanguage: Language;
  edited: boolean;
  busy: boolean;
  disabled?: boolean;
  onTranslatedChange: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
  onRetry: () => void;
  error: string | null;
}) {
  return (
    <div
      style={{
        border: '1px solid var(--accent)',
        borderRadius: 8,
        padding: 10,
        marginBottom: 8,
        background: '#f7faff'
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
        내가 쓴 원문 ({languageLabel(originalLanguage)})
      </div>
      <div style={{ fontSize: 13, marginBottom: 10, whiteSpace: 'pre-wrap' }}>{original}</div>

      <div
        style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          marginBottom: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}
      >
        고객에게 보낼 문장 ({languageLabel(targetLanguage)})
        {edited && <span style={{ color: 'var(--accent)' }}>· 직접 수정함</span>}
        <button
          type="button"
          onClick={onRetry}
          disabled={busy || disabled}
          style={{
            marginLeft: 'auto',
            border: 'none',
            background: 'none',
            color: 'var(--accent)',
            fontSize: 11,
            cursor: busy ? 'not-allowed' : 'pointer',
            textDecoration: 'underline'
          }}
        >
          다시 번역
        </button>
      </div>

      <textarea
        value={translated}
        onChange={(e) => onTranslatedChange(e.target.value)}
        rows={3}
        maxLength={2000}
        disabled={busy || disabled}
        aria-label="번역문 확인·수정"
        style={{ resize: 'vertical', marginBottom: 8 }}
      />

      {error && (
        <p role="alert" style={{ color: 'var(--danger)', fontSize: 11, margin: '0 0 8px' }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onCancel} disabled={busy || disabled}>
          취소
        </Button>
        <Button variant="primary" onClick={onSend} disabled={busy || disabled || translated.trim() === '' || translated.trim().length > 2000}>
          {busy ? '전송 중…' : '이대로 전송'}
        </Button>
      </div>
    </div>
  );
}
