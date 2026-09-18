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

/** DOM 갱신 전 저장한 위치를 기준으로 따라가거나 보이는 메시지 앵커를 보존한다. */
export function useMessageScroller({ itemCount, roomId }: { itemCount: number; roomId: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasNewBelow, setHasNewBelow] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const previousRoom = useRef<string | null>(null);
  const previousCount = useRef(itemCount);
  const nearBottom = useRef(true);
  const savedTop = useRef(0);
  const anchor = useRef<{ node: Element; offset: number } | null>(null);

  const capture = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    savedTop.current = el.scrollTop;
    const top = el.getBoundingClientRect().top;
    const firstVisible = [...el.children].find(child => child.getBoundingClientRect().bottom > top);
    anchor.current = firstVisible ? { node: firstVisible, offset: firstVisible.getBoundingClientRect().top - top } : null;
  }, []);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    nearBottom.current = true;
    setScrollTop(el, el.scrollHeight, smooth);
    setHasNewBelow(false); setNewCount(0);
    capture();
  }, [capture]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
    capture();
    saveScrollTop(roomId, el.scrollTop);
    if (nearBottom.current) { setHasNewBelow(false); setNewCount(0); }
  }, [roomId, capture]);

  const restoreAnchor = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (nearBottom.current) {
      setScrollTop(el, el.scrollHeight);
    } else if (anchor.current && el.contains(anchor.current.node)) {
      el.scrollTop += anchor.current.node.getBoundingClientRect().top - el.getBoundingClientRect().top - anchor.current.offset;
    } else {
      el.scrollTop = savedTop.current;
    }
    capture();
  }, [capture]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const changed = previousRoom.current !== roomId;
    const added = itemCount - previousCount.current;
    previousRoom.current = roomId;
    previousCount.current = itemCount;
    if (changed) {
      const top = readSavedScrollTop(roomId);
      setScrollTop(el, top ?? el.scrollHeight);
      nearBottom.current = top === null || el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
      setHasNewBelow(false); setNewCount(0);
      capture();
      return;
    }
    restoreAnchor();
    if (!nearBottom.current && added > 0) {
      setHasNewBelow(true); setNewCount(value => value + added);
    }
  });

  // 번역문 추가·줄바꿈·창 크기 변경은 메시지 개수가 같아도 높이를 바꾼다.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => restoreAnchor());
    observer.observe(el);
    for (const child of el.children) observer.observe(child);
    return () => observer.disconnect();
  }, [roomId, itemCount, restoreAnchor]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    return () => { if (el) saveScrollTop(roomId, el.scrollTop); };
  }, [roomId]);

  return { scrollRef, hasNewBelow, newCount, scrollToBottom, onScroll };
}
