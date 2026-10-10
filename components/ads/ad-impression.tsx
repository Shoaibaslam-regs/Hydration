"use client";

import { useEffect, useRef } from "react";

/**
 * Counts one impression when at least half of the ad is on screen, once per
 * browser session per ad. Renders its children unchanged.
 */
export function AdImpression({ kind, id, children, className }: { kind: "sponsored" | "banner"; id: string; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const key = `ad-seen:${kind}:${id}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      // Storage blocked: still count, just without de-duplication.
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        try {
          sessionStorage.setItem(key, "1");
        } catch {}
        fetch("/api/ads/event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, id }),
          keepalive: true,
        }).catch(() => {});
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [kind, id]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
