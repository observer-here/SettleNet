import { useCallback, useEffect, useRef, useState } from "react";

const THRESHOLD = 72;
const MAX_PULL = 120;
const MOBILE_MQ = "(max-width: 767px)";

export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pullRef = useRef(0);
  const pulling = useRef(false);
  const armed = useRef(false);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const setPullBoth = (v: number) => {
    pullRef.current = v;
    setPull(v);
  };

  const runRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setPullBoth(THRESHOLD);
    try {
      await onRefreshRef.current();
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
      setPullBoth(0);
    }
  }, []);

  useEffect(() => {
    const mobile = () => window.matchMedia(MOBILE_MQ).matches;
    const atTop = () => (window.scrollY || document.documentElement.scrollTop || 0) <= 2;

    const onStart = (e: TouchEvent) => {
      if (!mobile() || refreshingRef.current) return;
      if (!atTop()) {
        armed.current = false;
        return;
      }
      startY.current = e.touches[0]!.clientY;
      armed.current = true;
      pulling.current = false;
    };

    const onMove = (e: TouchEvent) => {
      if (!armed.current || refreshingRef.current) return;
      const dy = e.touches[0]!.clientY - startY.current;
      if (dy <= 0 || !atTop()) {
        if (pulling.current) {
          pulling.current = false;
          setPullBoth(0);
        }
        return;
      }
      pulling.current = true;
      const dist = Math.min(MAX_PULL, dy * 0.45);
      setPullBoth(dist);
      if (e.cancelable && dist > 8) e.preventDefault();
    };

    const onEnd = () => {
      if (!armed.current) return;
      armed.current = false;
      if (!pulling.current) return;
      pulling.current = false;
      if (pullRef.current >= THRESHOLD) void runRefresh();
      else setPullBoth(0);
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [runRefresh]);

  return { pull, refreshing, threshold: THRESHOLD };
}
