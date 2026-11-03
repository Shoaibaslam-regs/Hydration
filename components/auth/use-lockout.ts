"use client";

import { useEffect, useState } from "react";

/**
 * Countdown for a temporary lock (too many failed attempts). `lock(seconds)`
 * starts it; `secondsLeft` ticks down each second and is 0 when unlocked.
 * The server enforces the lock either way, so a reload just shows it again
 * on the next try.
 */
export function useLockout() {
  const [until, setUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (until === null) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= until) setUntil(null);
    }, 1000);
    return () => clearInterval(t);
  }, [until]);

  const secondsLeft = until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1000));
  return {
    secondsLeft,
    lock: (seconds: number) => {
      const n = Date.now();
      setNow(n);
      setUntil(n + seconds * 1000);
    },
  };
}

/** 875 → "14:35". */
export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return `${m}:${String(seconds % 60).padStart(2, "0")}`;
}
