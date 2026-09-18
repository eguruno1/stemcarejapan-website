'use client';

import { useRef, useState } from 'react';
import type { Language, MessageDTO } from '@stemcare/shared';
import { sendOperatorMessage } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { Button } from '@/components/ui/Button';

export function ChatComposer({
  roomId,
  disabled,
  onSent
}: {
  roomId: string;
  disabled: boolean;
  onSent: (message: MessageDTO) => void;
}) {
  const retry = useRef<{ text: string; language: Language; id: string } | null>(null);
  const sendingRef = useRef(false);
  const [text, setText] = useState('');
  // 운영자가 "지금 무슨 언어로 쓰고 있는가" 다. 고객의 선호 언어가 아니다.
  // 고객 언어로 바꿔 보내는 일은 Phase 5 의 번역이 담당한다.
  const [language, setLanguage] = useState<Language>('ko');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 2000 || disabled || sendingRef.current) return;
    sendingRef.current = true;
    if (retry.current?.text !== trimmed || retry.current?.language !== language) {
      retry.current = { text: trimmed, language, id: crypto.randomUUID() };
    }

    setSending(true);
    setError(null);

    try {
      const message = await sendOperatorMessage(roomId, {
        originalText: trimmed,
        originalLanguage: language,
        clientMessageId: retry.current.id
      });
      onSent(message);
      retry.current = null;
      setText(current => current.trim() === trimmed ? '' : current);
      const socket = getSocket();
      if (socket.connected) socket.emit('chat:typing', { roomId, isTyping: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : '전송에 실패했습니다.');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
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
      {error && (
        <p role="alert" style={{ color: 'var(--danger)', fontSize: 12, margin: '0 0 6px' }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
          aria-label="작성 언어"
          style={{ width: 84, flex: 'none' }}
          disabled={disabled}
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
              void handleSend();
            }
          }}
          rows={2}
          maxLength={2000}
          disabled={disabled}
          aria-label="답변 입력"
          placeholder={
            disabled ? '종료된 상담입니다.' : '답변을 입력하세요. (Enter 전송 / Shift+Enter 줄바꿈)'
          }
          style={{ resize: 'none', maxHeight: 120 }}
        />

        <Button
          variant="primary"
          onClick={() => void handleSend()}
          disabled={disabled || sending || text.trim() === ''}
          style={{ flex: 'none', height: 36 }}
        >
          {sending ? '전송 중…' : '전송'}
        </Button>
      </div>
    </div>
  );
}
