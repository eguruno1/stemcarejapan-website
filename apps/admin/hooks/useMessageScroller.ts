'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const NEAR_BOTTOM_PX = 100;
const SCROLL_STORAGE_PREFIX = 'scj-admin-scroll:';

function scrollStorageKey(roomId: string) {
  return `${SCROLL_STORAGE_PREFIX}${roomId}`;
}

function readSavedScrollTop(roomId: string): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(scrollStorageKey(roomId));
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function saveScrollTop(roomId: string, scrollTop: number) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      scrollStorageKey(roomId),
      String(Math.max(0, Math.round(scrollTop)))
    );
  } catch {
    /* 저장이 막혀 있어도 이번 세션 동작에는 영향이 없다. */
  }
}

/** jsdom 에는 Element.scrollTo 가 없다. 없으면 scrollTop 직접 대입으로 떨어진다. */
function setScrollTop(el: HTMLElement, top: number, smooth = false) {
  if (typeof el.scrollTo === 'function') {
    el.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
    return;
  }
  el.scrollTop = top;
}

/**
 * 채팅 메시지 목록의 스크롤을 관리한다.
 *
 * 규칙:
 * 1. 사용자가 맨 아래(100px 이내)를 보고 있으면 새 메시지를 자동으로 따라간다.
 * 2. 위로 올려 예전 메시지를 읽는 중이면 화면을 절대 움직이지 않고, 안 읽은 개수만 센다.
 * 3. 말풍선 높이가 나중에 바뀌어도(번역문 도착 등) 읽던 위치를 유지한다.
 * 4. 같은 상담방을 다시 열면 마지막으로 읽던 위치를 복원한다.
 * 5. 처음 여는 상담방이면 맨 아래에서 시작한다.
 */
export function useMessageScroller({ itemCount, roomId }: { itemCount: number; roomId: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const [hasNewBelow, setHasNewBelow] = useState(false);
  const [newCount, setNewCount] = useState(0);

  // 렌더 사이에 유지해야 하는 값들. state 로 두면 무한 렌더가 된다.
  const wasNearBottomRef = useRef(true);
  const previousCountRef = useRef(itemCount);
  const previousRoomIdRef = useRef(roomId);
  // DOM 이 바뀌기 직전의 "맨 아래까지 남은 거리"
  const distanceFromBottomRef = useRef(0);
  // 방을 떠날 때 마지막 위치를 저장하기 위해 현재 방 id 를 콜백에서 최신으로 읽는다.
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;

  const isNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
  }, []);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollTop(el, el.scrollHeight, smooth);
    setHasNewBelow(false);
    setNewCount(0);
    wasNearBottomRef.current = true;
  }, []);

  /** 스크롤할 때마다 "지금 아래를 보고 있나"를 기억해 둔다. */
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    wasNearBottomRef.current = isNearBottom();
    distanceFromBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight;
    saveScrollTop(roomIdRef.current, el.scrollTop);

    if (wasNearBottomRef.current) {
      setHasNewBelow(false);
      setNewCount(0);
    }
  }, [isNearBottom]);

  /**
   * useLayoutEffect 를 쓰는 이유:
   * DOM 이 갱신된 뒤 브라우저가 화면을 그리기 "전에" 스크롤을 보정해야 깜빡임이 없다.
   * useEffect 를 쓰면 사용자가 한 프레임 동안 튀는 화면을 본다.
   */
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const roomChanged = previousRoomIdRef.current !== roomId;
    const added = itemCount - previousCountRef.current;

    previousRoomIdRef.current = roomId;
    previousCountRef.current = itemCount;

    if (roomChanged) {
      // 다른 상담방을 열었다: 저장된 위치가 있으면 복원하고, 없으면 최신 메시지부터 본다.
      setHasNewBelow(false);
      setNewCount(0);
      const savedTop = readSavedScrollTop(roomId);
      if (savedTop !== null) {
        setScrollTop(el, savedTop);
        wasNearBottomRef.current = isNearBottom();
      } else {
        wasNearBottomRef.current = true;
        setScrollTop(el, el.scrollHeight);
      }
      return;
    }

    // 여기서 DOM 을 직접 잰다. 커밋이 끝난 뒤라 새 메시지 높이가 이미 포함돼 있지만,
    // 100px 여유가 보통 말풍선 한두 줄을 흡수하므로 "따라갈지" 판단에는 충분하다.
    // 스크롤 이벤트 값만 믿으면, 사용자가 한 번도 스크롤하지 않은 방에서
    // 항상 "맨 아래를 보고 있다"고 오판한다.
    if (isNearBottom()) {
      wasNearBottomRef.current = true;
      setScrollTop(el, el.scrollHeight);
      return;
    }
    wasNearBottomRef.current = false;

    // 예전 메시지를 읽는 중이다.
    // 아래쪽 내용이 늘어난 만큼 scrollTop 을 밀어 읽던 위치를 그대로 유지한다.
    el.scrollTop = el.scrollHeight - el.clientHeight - distanceFromBottomRef.current;

    if (added > 0) {
      setHasNewBelow(true);
      setNewCount((prev) => prev + added);
    }
  }, [itemCount, roomId, isNearBottom]);

  // 첫 마운트에서는 저장된 위치를 우선 복원하고, 없을 때만 맨 아래에서 시작한다.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const savedTop = readSavedScrollTop(roomIdRef.current);
    if (savedTop !== null) {
      setScrollTop(el, savedTop);
      wasNearBottomRef.current = isNearBottom();
      return;
    }

    scrollToBottom(false);
    // 마운트 시 한 번만 실행한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { scrollRef, hasNewBelow, newCount, scrollToBottom, onScroll };
}
