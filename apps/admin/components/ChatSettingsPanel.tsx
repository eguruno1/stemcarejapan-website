'use client';
import { useEffect, useState } from 'react';
import type { ChatSettingsDTO } from '@stemcare/shared';
import { fetchChatSettings, updateChatSettings, testTranslationProvider } from '@/lib/api';
import { Button } from './ui/Button';

export function ChatSettingsPanel() {
  const [settings, setSettings] = useState<ChatSettingsDTO | null>(null);
  const [models, setModels] = useState({ external: '', ollama: '' });
  const [externalConfigured, setExternalConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    fetchChatSettings().then(data => { if (!cancelled) { setSettings(data.settings); setModels(data.models); setExternalConfigured(data.externalConfigured); } })
      .catch(() => { if (!cancelled) setError('설정을 불러오지 못했습니다. 새로고침해주세요.'); });
    return () => { cancelled = true; };
  }, []);
  async function run(test: boolean) {
    if (!settings || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      if (test) {
        const data = await testTranslationProvider(settings.translationProvider);
        if (data.result.status !== 'done') throw new Error(data.message ?? '번역 연결 확인에 실패했습니다. Ollama 실행·모델 설치 또는 외부 API 키를 확인해주세요.');
        setMessage(`${data.result.model} · ${(data.elapsedMs / 1000).toFixed(1)}초: ${data.result.text}`);
      } else {
        setSettings(await updateChatSettings(settings));
        setMessage('저장했습니다. 이후 요청부터 적용됩니다. 이미 시작된 외부 요청은 취소되지 않을 수 있습니다.');
      }
    } catch (err) { setError(err instanceof Error ? err.message : '설정 처리에 실패했습니다.'); }
    finally { setBusy(false); }
  }
  return <section style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 18 }}>
    <h2 style={{ fontSize: 16 }}>상담·번역 설정</h2>
    <p style={{ fontSize: 12 }}>모든 운영자가 공유하는 설정이며 서버 재시작 후에도 유지됩니다. 1:1 상담은 AI 응답·요약 없이 운영자가 직접 응대하며, 상담방에서 상호 번역을 별도로 켤 수 있습니다.</p>
    {settings && <fieldset disabled={busy} style={{ border: 0, padding: 0, display: 'grid', gap: 14 }}>
      <label>번역 제공자
        <select aria-label="번역 제공자" value={settings.translationProvider} onChange={e => { setSettings({ ...settings, translationProvider: e.target.value as ChatSettingsDTO['translationProvider'] }); setMessage(''); }}>
          <option value="external">외부 API ({models.external})</option>
          <option value="ollama">로컬 Ollama ({models.ollama})</option>
        </select>
      </label>
      <p style={{ fontSize: 12, margin: 0 }}>로컬은 API 서버가 연결하는 Ollama입니다. 로컬 번역 실패 시 외부 API로 자동 전환하지 않습니다. 첫 요청은 모델 로딩으로 기본 제한 시간인 2분까지 걸릴 수 있습니다(서버 설정에 따라 달라짐). AI 상담·요약은 번역 제공자와 별개로 외부 API를 사용합니다.</p>
      {!externalConfigured && <p style={{ fontSize: 12, margin: 0 }}>외부 API 키가 없습니다. 로컬 번역 또는 1:1 상담은 사용 가능합니다.</p>}
      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input style={{ width: 'auto', margin: 0 }} type="checkbox" checked={settings.translationEnabled} onChange={e => setSettings({ ...settings, translationEnabled: e.target.checked })} /> 자동 번역 허용 (상담방별 선택)</label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input style={{ width: 'auto', margin: 0 }} type="checkbox" checked={settings.aiEnabled} onChange={e => setSettings({ ...settings, aiEnabled: e.target.checked })} /> 지원 상담의 AI 응답·요약 사용</label>
      <p style={{ fontSize: 12, margin: 0 }}>AI를 끄면 AI 상담 중인 방은 담당자 대기로 전환됩니다. 다시 켜도 이미 대기·진행 중인 방에 AI가 재개입하지 않습니다.</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button onClick={() => void run(false)}>설정 저장</Button>
        <Button variant="secondary" onClick={() => void run(true)}>선택한 제공자 연결 확인</Button>
      </div>
      <small>선택한 제공자는 「설정 저장」을 눌러야 실제 상담에 적용됩니다. 연결 확인만으로는 저장되지 않습니다. 연결 확인에는 예제 문장만 사용합니다.</small>
    </fieldset>}
    {busy && <p role="status">처리 중…</p>}
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
