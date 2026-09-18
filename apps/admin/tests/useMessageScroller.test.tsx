import { act, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMessageScroller } from '@/hooks/useMessageScroller';

/** jsdom 은 실제 레이아웃이 없으므로 스크롤 관련 값을 직접 흉내 낸다. */
function stubScrollMetrics(
  el: HTMLElement,
  metrics: { scrollTop: number; scrollHeight: number; clientHeight: number }
) {
  Object.defineProperty(el, 'scrollHeight', { value: metrics.scrollHeight, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: metrics.clientHeight, configurable: true });
  Object.defineProperty(el, 'scrollTop', {
    value: metrics.scrollTop,
    writable: true,
    configurable: true
  });
  el.scrollTo = ((options: ScrollToOptions) => {
    Object.defineProperty(el, 'scrollTop', {
      value: options.top ?? 0,
      writable: true,
      configurable: true
    });
  }) as HTMLElement['scrollTo'];
}

function savedScrollKey(roomId: string) {
  return `scj-admin-scroll:${roomId}`;
}

function Harness({ itemCount, roomId }: { itemCount: number; roomId: string }) {
  const { scrollRef, hasNewBelow, newCount, onScroll } = useMessageScroller({ itemCount, roomId });

  useEffect(() => {
    if (scrollRef.current) {
      // 800px 짜리 내용, 400px 창, 맨 아래에서 300px 위 → "예전 메시지를 읽는 중"
      stubScrollMetrics(scrollRef.current, { scrollTop: 100, scrollHeight: 800, clientHeight: 400 });
      fireEvent.scroll(scrollRef.current);
    }
  }, [scrollRef]);

  return (
    <div>
      <div data-testid="thread" ref={scrollRef} onScroll={onScroll} />
      <span data-testid="has-new">{String(hasNewBelow)}</span>
      <span data-testid="new-count">{newCount}</span>
    </div>
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
});

describe('useMessageScroller', () => {
  it('처음에는 새 메시지 표시가 없다', () => {
    render(<Harness itemCount={5} roomId="room-1" />);

    expect(screen.getByTestId('has-new')).toHaveTextContent('false');
    expect(screen.getByTestId('new-count')).toHaveTextContent('0');
  });

  it('위를 보는 중에 메시지가 늘면 새 메시지 표시가 켜진다', () => {
    const view = render(<Harness itemCount={5} roomId="room-1" />);

    act(() => {
      view.rerender(<Harness itemCount={7} roomId="room-1" />);
    });

    expect(screen.getByTestId('has-new')).toHaveTextContent('true');
    expect(screen.getByTestId('new-count')).toHaveTextContent('2');
  });

  it('맨 아래를 보고 있으면 새 메시지 표시가 켜지지 않는다', () => {
    function BottomHarness({ itemCount }: { itemCount: number }) {
      const { scrollRef, hasNewBelow, onScroll } = useMessageScroller({ itemCount, roomId: 'r' });
      useEffect(() => {
        if (scrollRef.current) {
          // scrollTop 400 + clientHeight 400 = 800 = scrollHeight → 맨 아래
          stubScrollMetrics(scrollRef.current, {
            scrollTop: 400,
            scrollHeight: 800,
            clientHeight: 400
          });
        }
      }, [scrollRef]);
      return (
        <div>
          <div ref={scrollRef} onScroll={onScroll} />
          <span data-testid="has-new">{String(hasNewBelow)}</span>
        </div>
      );
    }

    const view = render(<BottomHarness itemCount={5} />);
    act(() => {
      view.rerender(<BottomHarness itemCount={9} />);
    });

    expect(screen.getByTestId('has-new')).toHaveTextContent('false');
  });

  it('처음 여는 상담방으로 바뀌면 최신 메시지 위치에서 시작하고 새 메시지 표시가 초기화된다', () => {
    const view = render(<Harness itemCount={5} roomId="room-1" />);
    act(() => {
      view.rerender(<Harness itemCount={8} roomId="room-1" />);
    });
    expect(screen.getByTestId('has-new')).toHaveTextContent('true');

    act(() => {
      view.rerender(<Harness itemCount={8} roomId="room-2" />);
    });

    expect(screen.getByTestId('has-new')).toHaveTextContent('false');
    expect(screen.getByTestId('new-count')).toHaveTextContent('0');
  });

  it('다시 여는 상담방은 마지막으로 읽던 위치를 복원한다', () => {
    const view = render(<Harness itemCount={10} roomId="room-1" />);
    const thread = screen.getByTestId('thread');

    act(() => {
      stubScrollMetrics(thread, { scrollTop: 180, scrollHeight: 900, clientHeight: 400 });
      fireEvent.scroll(thread);
    });

    expect(window.sessionStorage.getItem(savedScrollKey('room-1'))).toBe('180');

    act(() => {
      view.rerender(<Harness itemCount={5} roomId="room-2" />);
    });
    act(() => {
      view.rerender(<Harness itemCount={10} roomId="room-1" />);
    });

    expect(thread.scrollTop).toBe(180);
  });

  it('메시지 수가 줄어도 새 메시지 표시가 켜지지 않는다', () => {
    const view = render(<Harness itemCount={9} roomId="room-1" />);

    act(() => {
      view.rerender(<Harness itemCount={4} roomId="room-1" />);
    });

    expect(screen.getByTestId('has-new')).toHaveTextContent('false');
  });
});

it('새 메시지로 높이가 늘어나도 과거를 읽는 scrollTop은 유지한다', () => {
  const view = render(<Harness itemCount={5} roomId="room-a" />);
  const thread = screen.getByTestId('thread');
  fireEvent.scroll(thread);
  Object.defineProperty(thread, 'scrollHeight', { value: 1100, configurable: true });
  view.rerender(<Harness itemCount={6} roomId="room-a" />);
  expect(thread.scrollTop).toBe(100);
  expect(screen.getByTestId('has-new')).toHaveTextContent('true');
});
it('맨 아래에서 긴 메시지가 도착하면 추가 높이가 100px 이상이어도 따라간다', () => {
  const view = render(<Harness itemCount={5} roomId="room-b" />);
  const thread = screen.getByTestId('thread');
  stubScrollMetrics(thread, { scrollTop: 400, scrollHeight: 800, clientHeight: 400 });
  fireEvent.scroll(thread);
  Object.defineProperty(thread, 'scrollHeight', { value: 1400, configurable: true });
  view.rerender(<Harness itemCount={6} roomId="room-b" />);
  expect(thread.scrollTop).toBeGreaterThanOrEqual(1000);
  expect(screen.getByTestId('has-new')).toHaveTextContent('false');
});

it('메시지 개수가 같아도 높이 변경을 관찰해 읽던 위치를 유지한다', () => {
  let resize!: () => void;
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resize = callback; }
    observe() {} disconnect() {}
  });
  try {
    const view = render(<Harness itemCount={5} roomId="resize-room" />);
    const thread = screen.getByTestId('thread');
    fireEvent.scroll(thread);
    Object.defineProperty(thread, 'scrollHeight', { value: 1200, configurable: true });
    act(() => resize());
    expect(thread.scrollTop).toBe(100);
    stubScrollMetrics(thread, { scrollTop: 800, scrollHeight: 1200, clientHeight: 400 });
    fireEvent.scroll(thread);
    Object.defineProperty(thread, 'scrollHeight', { value: 1500, configurable: true });
    act(() => resize());
    expect(thread.scrollTop).toBeGreaterThanOrEqual(1100);
    view.unmount();
  } finally { vi.unstubAllGlobals(); }
});
