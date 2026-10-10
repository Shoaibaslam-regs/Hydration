"use client";

import { useEffect, useState } from "react";
import type { PublicBanner } from "@/lib/services/ads/banners";
import { cn } from "@/lib/utils";
import { AdImpression } from "./ad-impression";

const ROTATE_MS = 7000;

/**
 * Home page promo banners. Rotates every few seconds, pauses on hover/focus or
 * when the user prefers reduced motion, and has dots for manual control.
 * Links go through the click counter as plain <a>s (never prefetched).
 */
export function BannerCarousel({ banners }: { banners: PublicBanner[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = banners.length;

  useEffect(() => {
    if (count < 2 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => clearInterval(t);
  }, [count, paused]);

  if (count === 0) return null;
  const b = banners[Math.min(index, count - 1)];

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Promotions"
      className="flex flex-col gap-3"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <AdImpression key={b.id} kind="banner" id={b.id}>
        <a
          href={`/api/ads/click?kind=banner&id=${b.id}`}
          className="group relative flex min-h-44 overflow-hidden rounded-2xl border border-border bg-accent sm:min-h-52"
          aria-label={`${b.title}. ${b.ctaLabel}`}
        >
          {b.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- served from our own API with long caching; sizes vary per banner
            <img src={b.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <span
            aria-hidden
            className={cn("absolute inset-0", b.imageUrl ? "bg-gradient-to-r from-black/75 via-black/55 to-black/25 sm:via-black/40 sm:to-transparent" : "")}
          />
          <span className={cn("relative flex max-w-xl flex-col justify-center gap-2 p-6 sm:p-8", b.imageUrl ? "text-white" : "text-accent-foreground")}>
            <span className="text-xs font-medium uppercase tracking-wide opacity-80">Promoted</span>
            <span className="text-xl font-bold sm:text-2xl">{b.title}</span>
            {b.subtitle && <span className={cn("text-sm", b.imageUrl ? "text-white/85" : "opacity-80")}>{b.subtitle}</span>}
            <span className="mt-1 inline-flex w-fit items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground group-hover:bg-primary-hover">
              {b.ctaLabel} →
            </span>
          </span>
        </a>
      </AdImpression>
      {count > 1 && (
        <div className="flex justify-center gap-2">
          {banners.map((x, i) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show promotion ${i + 1} of ${count}`}
              aria-current={i === index ? "true" : undefined}
              className={cn("h-2 rounded-full transition-all", i === index ? "w-6 bg-primary" : "w-2 bg-border hover:bg-muted-foreground")}
            />
          ))}
        </div>
      )}
    </section>
  );
}
