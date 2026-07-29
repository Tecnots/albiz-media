"use client";

import { useRef, useCallback, useState, useEffect } from "react";

interface PullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  /** Pull distance in px required to trigger refresh. Default 64. */
  threshold?: number;
  /** Max visual pull distance in px. Default 100. */
  maxPull?: number;
  /** Disable the hook entirely. Default false. */
  disabled?: boolean;
}

interface PullToRefreshResult {
  /** Attach this ref to your scrollable container (<main>, <div>, etc.) */
  containerRef: React.RefCallback<HTMLElement>;
  /** Current pull distance (0 when idle). Use for indicator positioning. */
  pullDistance: number;
  /** Whether a refresh is in progress */
  refreshing: boolean;
  /** Whether the user has pulled past the threshold */
  pastThreshold: boolean;
  /** Programmatic refresh (for web refresh button) */
  triggerRefresh: () => void;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 64,
  maxPull = 100,
  disabled = false,
}: PullToRefreshOptions): PullToRefreshResult {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const containerEl = useRef<HTMLElement | null>(null);
  const startY = useRef(0);
  const pulling = useRef(false);
  const currentPull = useRef(0); // mirrors pullDistance for event handlers (avoids stale closure)
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const doRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setPullDistance(0);
    currentPull.current = 0;
    try {
      await onRefreshRef.current();
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, []);

  const triggerRefresh = useCallback(() => {
    doRefresh();
  }, [doRefresh]);

  useEffect(() => {
    const el = containerEl.current;
    if (!el || disabled) return;

    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      if (el.scrollTop > 0) return;
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling.current || refreshingRef.current) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy < 0) {
        pulling.current = false;
        currentPull.current = 0;
        setPullDistance(0);
        return;
      }
      const dampened = Math.min(dy * 0.4, maxPull);
      currentPull.current = dampened;
      setPullDistance(dampened);
      if (dampened > 4 && el.scrollTop === 0) {
        e.preventDefault();
      }
    };

    const onTouchEnd = () => {
      if (!pulling.current) return;
      pulling.current = false;
      if (currentPull.current >= threshold) {
        doRefresh();
      } else {
        currentPull.current = 0;
        setPullDistance(0);
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [disabled, threshold, maxPull, doRefresh]);

  const containerRef = useCallback((node: HTMLElement | null) => {
    containerEl.current = node;
  }, []);

  return {
    containerRef,
    pullDistance,
    refreshing,
    pastThreshold: pullDistance >= threshold,
    triggerRefresh,
  };
}
