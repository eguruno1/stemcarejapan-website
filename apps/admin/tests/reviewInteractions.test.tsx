import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { CustomerSidebar } from '@/components/chat/CustomerSidebar';
import { sendOperatorMessage, fetchCustomerHistory } from '@/lib/api';
import type { ChatRoomDetail, MessageDTO } from '@stemcare/shared';
vi.mock('@/lib/api', () => ({ sendOperatorMessage: vi.fn(), fetchCustomerHistory: vi.fn() }));
// ChatComposer 는 입력할 때마다 getSocket() 으로 타이핑 신호를 보낸다.
// 실제 소켓을 붙이면 이 유닛 테스트가 실제 API 서버로 연결을 시도하게 된다.
vi.mock('@/lib/socket', () => ({
  getSocket: () => ({ connected: false, on: vi.fn(), off: vi.fn(), emit: vi.fn() }),
  closeSocket: vi.fn()
}));
beforeEach(() => vi.resetAllMocks());
it('한일 IME 확정 Enter로 답변을 보내지 않는다', () => {
  render(<ChatComposer roomId="a" disabled={false} onSent={vi.fn()} />);
  const input = screen.getByLabelText('답변 입력');
  fireEvent.change(input, { target: { value: '안녕하세요' } });
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true, keyCode: 229 });
  expect(sendOperatorMessage).not.toHaveBeenCalled();
});
it('전송 결과를 잃어 재시도할 때 동일한 clientMessageId를 사용한다', async () => {
  vi.mocked(sendOperatorMessage).mockRejectedValueOnce(new Error('네트워크 오류')).mockResolvedValue({ id: 'one', chatRoomId: 'a' } as MessageDTO);
  render(<ChatComposer roomId="a" disabled={false} onSent={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('답변 입력'), { target: { value: '답변' } });
  fireEvent.click(screen.getByText('전송'));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByText('전송'));
  await waitFor(() => expect(sendOperatorMessage).toHaveBeenCalledTimes(2));
  const calls = vi.mocked(sendOperatorMessage).mock.calls;
  expect(calls[0][1].clientMessageId).toBeTruthy();
  expect(calls[1][1].clientMessageId).toBe(calls[0][1].clientMessageId);
});
it('전송 중 새로 작성한 초안을 성공 응답이 지우지 않는다', async () => {
  let resolve!: (message: MessageDTO) => void;
  vi.mocked(sendOperatorMessage).mockImplementation(() => new Promise(r => { resolve = r; }));
  render(<ChatComposer roomId="a" disabled={false} onSent={vi.fn()} />);
  const input = screen.getByLabelText('답변 입력');
  fireEvent.change(input, { target: { value: '첫 답변' } }); fireEvent.click(screen.getByText('전송'));
  fireEvent.change(input, { target: { value: '다음 답변' } });
  await act(async () => resolve({ id: 'one', chatRoomId: 'a' } as MessageDTO));
  expect(input).toHaveValue('다음 답변');
});
it('이력 조회 실패를 첫 상담이라고 표시하지 않는다', async () => {
  vi.mocked(fetchCustomerHistory).mockRejectedValue(new Error('실패'));
  const room = { id: 'a', status: 'active', serviceType: 'stemcell', assignedOperatorId: null, createdAt: new Date().toISOString(), customer: { name: '고객', phone: '12345', preferredLanguage: 'ja' }, notes: [], summary: null } as unknown as ChatRoomDetail;
  render(<CustomerSidebar room={room} onChanged={vi.fn()} onNoteCreated={vi.fn()} />);
  await screen.findByText('이전 상담을 불러오지 못했습니다.');
  expect(screen.queryByText('이 고객의 첫 상담입니다.')).toBeNull();
});
