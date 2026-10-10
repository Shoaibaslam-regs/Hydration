"use client";

import { useEffect, useState } from "react";

export type NotificationCounts = { counts: Record<string, number>; total: number };

const EMPTY: NotificationCounts = { counts: {}, total: 0 };
const POLL_MS = 30_000;

/**
 * Live counts for the dashboard links (new orders, requests to review…).
 * Refetches every 30 s, when the tab regains focus, and whenever `refreshKey`
 * changes (pass the pathname so counts update after navigating).
 */
export function useNotificationCounts(refreshKey?: string | null): NotificationCounts {
  const [state, setState] = useState<NotificationCounts>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as NotificationCounts;
        if (!cancelled) setState(data);
      } catch {
        // Offline or server restarting: keep the last counts.
      }
    }
    load();
    const timer = setInterval(load, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", load);
    };
  }, [refreshKey]);

  return state;
}
