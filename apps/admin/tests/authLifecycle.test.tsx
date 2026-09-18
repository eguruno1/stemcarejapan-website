import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '@/components/AuthProvider';
import { fetchRooms } from '@/lib/api';
const operator = { id: 'op', name: '운영자', email: 'test@example.com', role: 'operator', isActive: true };
function Harness() {
  const { status, error, signOut, signIn } = useAuth();
  return <><span>{status}</span>{error && <p role="alert">{error}</p>}<button onClick={() => void signOut()}>out</button><button onClick={() => void signIn('test@example.com', 'password')}>in</button></>;
}
beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
afterEach(() => vi.unstubAllGlobals());
it('보호 API 401이면 기존 인증 상태를 즉시 해제한다', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ operator }))).mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), { status: 401 }));
  render(<AuthProvider><Harness /></AuthProvider>);
  await screen.findByText('authenticated');
  await act(async () => { await fetchRooms().catch(() => {}); });
  expect(screen.getByText('anonymous')).toBeInTheDocument();
});
it('로그아웃 실패를 성공으로 표시하지 않는다', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ operator }))).mockRejectedValueOnce(new Error('offline'));
  render(<AuthProvider><Harness /></AuthProvider>);
  await screen.findByText('authenticated'); fireEvent.click(screen.getByText('out'));
  await screen.findByRole('alert');
  expect(screen.getByText('authenticated')).toBeInTheDocument();
});
it('초기 세션 조회 응답이 늦어도 완료된 로그인을 덮어쓰지 않는다', async () => {
  let resolve!: (r: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(() => new Promise(r => { resolve = r; })).mockResolvedValueOnce(new Response(JSON.stringify({ operator })));
  render(<AuthProvider><Harness /></AuthProvider>);
  fireEvent.click(screen.getByText('in'));
  await screen.findByText('authenticated');
  await act(async () => resolve(new Response(JSON.stringify({ error: {} }), { status: 401 })));
  await waitFor(() => expect(screen.getByText('authenticated')).toBeInTheDocument());
});
