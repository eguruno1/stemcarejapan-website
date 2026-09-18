'use client';

import { useRef, useState } from 'react';
import type { Language, MessageDTO } from '@stemcare/shared';
import { previewTranslation, sendOperatorMessage } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { Button } from '@/components/ui/Button';
import { languageLabel } from '@/lib/labels';
import { TranslationPreview } from './TranslationPreview';

type Draft = {
  originalText: string;
  originalLanguage: Language;
  translated: string;
  targetLanguage: Language;
  edited: boolean;
};

export function ChatComposer({
  roomId,
  disabled,
  customerLanguage,
  onSent
}: {
  roomId: string;
  disabled: boolean;
  customerLanguage: Language;
  onSent: (message: MessageDTO) => void;
}) {
  // 재전송 시 같은 clientMessageId 를 재사용해 중복 메시지를 막는다.
  const retry = useRef<{ key: string; id: string } | null>(null);
  const sendingRef = useRef(false);
  const [text, setText] = useState('');
  // 운영자가 "지금 무슨 언어로 쓰고 있는가" 다. 고객의 선호 언어가 아니다.
  const [language, setLanguage] = useState<Language>('ko');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  const needsTranslation = language !== customerLanguage;
  const locked = disabled || draft !== null || previewLoading;

  async function sendMessage(
    payload: {
      originalText: string;
      originalLanguage: Language;
      translatedText?: string;
      translatedLanguage?: Language;
      translationEdited?: boolean;
    },
    viaDraft: boolean
  ) {
    if (sendingRef.current) return;
    sendingRef.current = true;
    const key = `${payload.originalText}::${payload.originalLanguage}::${payload.translatedText ?? ''}`;
    if (retry.current?.key !== key) {
      retry.current = { key, id: crypto.randomUUID() };
    }

    setSending(true);
    if (viaDraft) {
      setDraftBusy(true);
      setDraftError(null);
    } else {
      setError(null);
    }

    try {
      const message = await sendOperatorMessage(roomId, { ...payload, clientMessageId: retry.current.id });
      onSent(message);
      retry.current = null;
      setDraft(null);
      setText(current => (viaDraft || current.trim() === payload.originalText ? '' : current));
      const socket = getSocket();
      if (socket.connected) socket.emit('chat:typing', { roomId, isTyping: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : '전송에 실패했습니다.';
      if (viaDraft) setDraftError(message);
      else setError(message);
    } finally {
      sendingRef.current = false;
      setSending(false);
      if (viaDraft) setDraftBusy(false);
    }
  }

  async function handlePrepareSend() {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 2000 || locked || sendingRef.current || previewLoading) return;

    if (!needsTranslation) {
      void sendMessage({ originalText: trimmed, originalLanguage: language }, false);
      return;
    }

    setError(null);
    setPreviewLoading(true);
    try {
      const { translatedText } = await previewTranslation({
        roomId,
        text: trimmed,
        sourceLanguage: language,
        targetLanguage: customerLanguage
      });
      setDraft({
        originalText: trimmed,
        originalLanguage: language,
        translated: translatedText,
        targetLanguage: customerLanguage,
        edited: false
      });
    } catch (err) {
      // 번역이 실패해도 운영자가 직접 번역문을 써서 보낼 수 있도록 빈 미리보기를 연다.
      setDraft({
        originalText: trimmed,
        originalLanguage: language,
        translated: '',
        targetLanguage: customerLanguage,
        edited: false
      });
      setDraftError(err instanceof Error ? err.message : '번역에 실패했습니다. 직접 작성해주세요.');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleRetryTranslation() {
    if (!draft || draftBusy) return;
    setDraftBusy(true);
    setDraftError(null);
    try {
      const { translatedText } = await previewTranslation({
        roomId,
        text: draft.originalText,
        sourceLanguage: draft.originalLanguage,
        targetLanguage: draft.targetLanguage
      });
      setDraft(current => (current ? { ...current, translated: translatedText, edited: false } : current));
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : '번역에 실패했습니다.');
    } finally {
      setDraftBusy(false);
    }
  }

  function handleDraftChange(value: string) {
    setDraft(current => (current ? { ...current, translated: value, edited: true } : current));
  }

  async function handleSendDraft() {
    if (!draft || draft.translated.trim() === '') return;
    await sendMessage(
      {
        originalText: draft.originalText,
        originalLanguage: draft.originalLanguage,
        translatedText: draft.translated.trim(),
        translatedLanguage: draft.targetLanguage,
        translationEdited: draft.edited
      },
      true
    );
  }

  function handleCancelDraft() {
    setDraft(null);
    setDraftError(null);
  }

  return (
    <div
      style={{
        flex: 'none',
        borderTop: '1px solid var(--border)',
        padding: 10,
        background: 'var(--surface)'
      }}
    >
      {draft && (
        <TranslationPreview
          original={draft.originalText}
          originalLanguage={draft.originalLanguage}
          translated={draft.translated}
          targetLanguage={draft.targetLanguage}
          edited={draft.edited}
          busy={draftBusy}
          onTranslatedChange={handleDraftChange}
          onSend={() => void handleSendDraft()}
          onCancel={handleCancelDraft}
          onRetry={() => void handleRetryTranslation()}
          error={draftError}
        />
      )}

      {error && (
        <p role="alert" style={{ color: 'var(--danger)', fontSize: 12, margin: '0 0 6px' }}>
          {error}
        </p>
      )}

      {!draft && needsTranslation && !disabled && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 6px' }}>
          고객 선호 언어({languageLabel(customerLanguage)})로 번역해 확인한 뒤 전송됩니다.
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
          aria-label="작성 언어"
          style={{ width: 84, flex: 'none' }}
          disabled={locked}
        >
          <option value="ko">한국어</option>
          <option value="ja">일본어</option>
        </select>

        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const socket = getSocket();
            if (socket.connected) {
              socket.emit('chat:typing', { roomId, isTyping: e.target.value.trim().length > 0 });
            }
          }}
          onKeyDown={(e) => {
            // Enter 전송, Shift+Enter 줄바꿈
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
              e.preventDefault();
              void handlePrepareSend();
            }
          }}
          rows={2}
          maxLength={2000}
          disabled={locked}
          aria-label="답변 입력"
          placeholder={
            disabled ? '종료된 상담입니다.' : '답변을 입력하세요. (Enter 전송 / Shift+Enter 줄바꿈)'
          }
          style={{ resize: 'none', maxHeight: 120 }}
        />

        <Button
          variant="primary"
          onClick={() => void handlePrepareSend()}
          disabled={locked || sending || previewLoading || text.trim() === ''}
          style={{ flex: 'none', height: 36 }}
        >
          {previewLoading ? '번역 중…' : sending ? '전송 중…' : needsTranslation ? '번역 확인' : '전송'}
        </Button>
      </div>
    </div>
  );
}
