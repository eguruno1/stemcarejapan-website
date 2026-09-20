'use client';

import type { MessageDTO, TranslationStatus } from '@stemcare/shared';
import { formatTime } from '@/lib/format';
import { senderLabel } from '@/lib/labels';

const TRANSLATION_HINTS: Record<TranslationStatus, string | null> = {
  none: null,
  pending: '번역 중…',
  done: null,
  failed: '번역 실패 · 원문만 표시합니다.',
  edited: '운영자가 직접 수정한 번역문입니다.'
};

export function MessageBubble({
  message,
  onRetranslate,
  view = 'both'
}: {
  message: MessageDTO;
  view?: 'both' | 'original' | 'translated';
  onRetranslate?: (messageId: string) => void;
}) {
  // 운영자 화면 기준: 고객/AI 는 왼쪽, 운영자(나) 는 오른쪽
  const isOutgoing = message.senderType === 'operator';
  const hint = TRANSLATION_HINTS[message.translationStatus] ?? null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isOutgoing ? 'flex-end' : 'flex-start',
        gap: 3,
        flex: 'none'
      }}
    >
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        {senderLabel(message.senderType)} · {message.originalLanguage.toUpperCase()}
      </span>

      <div
        style={{
          maxWidth: '78%',
          background: isOutgoing ? '#1f5fbf' : 'var(--surface)',
          color: isOutgoing ? '#fff' : 'var(--text)',
          border: isOutgoing ? 'none' : '1px solid var(--border)',
          borderRadius: 10,
          padding: '8px 11px',
          fontSize: 13,
          lineHeight: 1.55,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }}
      >
        {/* 원문 */}
        {(view !== 'translated' || !message.translatedText) && <div>{message.originalText}</div>}

        {/* 번역문: 원문과 시각적으로 확실히 구분한다 */}
        {view !== 'original' && message.translatedText && (
          <div data-testid="message-translation"
            style={{
              marginTop: 6,
              paddingTop: 6,
              borderTop: `1px dashed ${isOutgoing ? 'rgba(255,255,255,0.35)' : 'var(--border)'}`,
              opacity: 0.9
            }}
          >
            <span style={{ fontSize: 10, opacity: 0.75, display: 'block', marginBottom: 2 }}>
              {message.translatedLanguage?.toUpperCase()} 번역
            </span>
            {message.translatedText}
          </div>
        )}

        {view !== 'original' && hint && (
          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              color: message.translationStatus === 'failed' && isOutgoing ? '#ffd2d2' : undefined,
              opacity: 0.85,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            {hint}
            {message.translationStatus === 'failed' && onRetranslate && (
              <button
                type="button"
                onClick={() => onRetranslate(message.id)}
                style={{
                  border: 'none',
                  background: 'none',
                  padding: 0,
                  font: 'inherit',
                  color: isOutgoing ? '#ffd2d2' : 'var(--accent)',
                  textDecoration: 'underline',
                  cursor: 'pointer'
                }}
              >
                다시 번역
              </button>
            )}
          </div>
        )}
      </div>

      {message.senderType === 'customer' && message.originalLanguage !== 'ko' && message.translationStatus === 'none' && !message.translatedText && onRetranslate && (
        <button type="button" onClick={() => onRetranslate(message.id)} style={{ fontSize: 11 }}>한국어로 번역</button>
      )}
      <span data-testid="message-time" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
        {formatTime(message.createdAt)}
      </span>
    </div>
  );
}
