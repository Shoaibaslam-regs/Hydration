"use client";

import { useEffect, useState } from "react";
import type { PublicBanner } from "@/lib/services/ads/banners";
import { cn } from "@/lib/utils";
import { AdChip } from "./ad-chip";
import { AdImpression } from "./ad-impression";

const ROTATE_MS = 7000;

/**
 * Home page advertisements in the gold "premium" style, clearly marked as
 * ads ("Advertisement" label, "Sponsored" ribbon, "Ad" chip, advertiser name). Rotates every few
 * seconds, pauses on hover/focus or when the user prefers reduced motion, and
 * has arrows and dots for manual control. Links go through the click counter
 * as plain <a>s (never prefetched).
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
  const current = Math.min(index, count - 1);
  const b = banners[current];
  const go = (delta: number) => setIndex((current + delta + count) % count);
  const onImage = Boolean(b.imageUrl);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Advertisements"
      className="flex flex-col gap-2"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">Advertisement</p>
      <div className="relative rounded-2xl bg-gradient-to-r from-premium via-premium/40 to-premium p-[2px] shadow-lg shadow-premium/10">
        <AdImpression key={b.id} kind="banner" id={b.id}>
          <a
            href={`/api/ads/click?kind=banner&id=${b.id}`}
            className={cn(
              "group relative flex min-h-52 overflow-hidden rounded-[calc(1rem-2px)] sm:min-h-60",
              onImage ? "bg-black" : "bg-gradient-to-br from-premium-soft via-card to-accent",
            )}
            aria-label={`Advertisement${b.sponsorName ? ` from ${b.sponsorName}` : ""}: ${b.title}. ${b.ctaLabel}`}
          >
            {onImage ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- served from our own API with long caching; sizes vary per banner */}
                <img
                  src={b.imageUrl!}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
                <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/20 sm:via-black/45 sm:to-transparent" />
              </>
            ) : (
              <>
                {/* Decorative gold glows on the plain banner. */}
                <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-premium/20 blur-3xl" />
                <span aria-hidden className="pointer-events-none absolute -bottom-24 right-1/3 size-56 rounded-full bg-primary/10 blur-3xl" />
              </>
            )}

            {/* Diagonal "Sponsored" ribbon across the top-left corner. */}
            <span aria-hidden className="pointer-events-none absolute -left-10 top-4 w-36 -rotate-45 bg-premium py-1 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-premium-foreground shadow-md">
              Sponsored
            </span>
            <AdChip className={cn("absolute right-3 top-3 bg-background/85 text-foreground backdrop-blur-sm", onImage && "bg-black/40 text-white")} />

            <span
              key={b.id}
              className={cn(
                "animate-banner-in relative flex max-w-2xl flex-col justify-center gap-3 px-6 pb-7 pt-16 sm:px-16 sm:py-10",
                onImage ? "text-white" : "text-foreground",
              )}
            >
              <span className="text-3xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">{b.title}</span>
              <span aria-hidden className="h-1 w-16 rounded-full bg-premium" />
              {b.subtitle && <span className={cn("max-w-lg text-sm sm:text-base", onImage ? "text-white/85" : "text-muted-foreground")}>{b.subtitle}</span>}
              <span className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
                <span className="inline-flex items-center gap-1 rounded-full bg-premium px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-premium-foreground shadow-md transition-transform group-hover:translate-x-0.5">
                  {b.ctaLabel} →
                </span>
                {b.sponsorName && (
                  <span className={cn("text-xs", onImage ? "text-white/75" : "text-muted-foreground")}>
                    Sponsored by <span className="font-semibold">{b.sponsorName}</span>
                  </span>
                )}
              </span>
            </span>
          </a>
        </AdImpression>

        {count > 1 && (
          <>
            <ArrowButton side="left" onClick={() => go(-1)} label="Previous advertisement" />
            <ArrowButton side="right" onClick={() => go(1)} label="Next advertisement" />
          </>
        )}
      </div>

      {count > 1 && (
        <div className="flex justify-center gap-2 pt-1">
          {banners.map((x, i) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show advertisement ${i + 1} of ${count}`}
              aria-current={i === current ? "true" : undefined}
              className={cn("h-2 rounded-full transition-all", i === current ? "w-6 bg-premium" : "w-2 bg-border hover:bg-premium/50")}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ArrowButton({ side, onClick, label }: { side: "left" | "right"; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "absolute top-1/2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/85 text-lg text-foreground shadow-md ring-1 ring-premium/40 backdrop-blur-sm transition-colors hover:bg-premium hover:text-premium-foreground sm:flex",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      <span aria-hidden>{side === "left" ? "‹" : "›"}</span>
    </button>
  );
}
