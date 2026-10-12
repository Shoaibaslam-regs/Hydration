"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { PublicBanner } from "@/lib/services/ads/banners";
import { cn } from "@/lib/utils";
import { AdChip } from "./ad-chip";
import { AdImpression } from "./ad-impression";

const ROTATE_MS = 7000;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** The user's reduced-motion setting, kept in sync; false while server-rendering. */
function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, () => window.matchMedia(REDUCED_MOTION).matches, () => false);
}

/**
 * Home page advertisements in the gold "premium" style, clearly marked as
 * ads ("Advertisement" label, "Sponsored" ribbon, "Ad" chip, advertiser name). Rotates every few
 * seconds, pauses on hover/focus or when the user prefers reduced motion, and
 * has arrows and dots for manual control. Links go through the click counter
 * as plain <a>s (never prefetched).
 *
 * A banner with a short video plays it muted (never with reduced motion) with
 * play/pause and sound buttons; the carousel moves on when the clip ends
 * instead of on the timer.
 */
export function BannerCarousel({ banners }: { banners: PublicBanner[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const reducedMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const count = banners.length;
  const current = Math.min(index, Math.max(count - 1, 0));
  const hasVideo = Boolean(banners[current]?.videoUrl);

  useEffect(() => {
    // A playing clip advances the carousel itself when it ends.
    if (count < 2 || paused || reducedMotion || (hasVideo && videoPlaying)) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => clearInterval(t);
  }, [count, paused, reducedMotion, hasVideo, videoPlaying]);

  if (count === 0) return null;
  const b = banners[current];
  const go = (delta: number) => {
    setVideoPlaying(false);
    setIndex((current + delta + count) % count);
  };
  const onImage = Boolean(b.imageUrl || b.videoUrl);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  }

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
              "group relative flex min-h-36 overflow-hidden rounded-[calc(1rem-2px)] sm:min-h-40",
              onImage ? "bg-black" : "bg-gradient-to-br from-premium-soft via-card to-accent",
            )}
            aria-label={`Advertisement${b.sponsorName ? ` from ${b.sponsorName}` : ""}: ${b.title}. ${b.ctaLabel}`}
          >
            {b.videoUrl ? (
              <>
                <video
                  key={b.id}
                  ref={videoRef}
                  src={b.videoUrl}
                  poster={b.imageUrl ?? undefined}
                  autoPlay={!reducedMotion}
                  muted={muted}
                  loop={count < 2}
                  playsInline
                  preload="metadata"
                  aria-hidden
                  onPlay={() => setVideoPlaying(true)}
                  // Autoplay can start before hydration, missing the play event; catch up here.
                  onTimeUpdate={(e) => !videoPlaying && !e.currentTarget.paused && setVideoPlaying(true)}
                  onPause={() => setVideoPlaying(false)}
                  onEnded={() => count > 1 && go(1)}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/10 sm:via-black/40 sm:to-transparent" />
              </>
            ) : onImage ? (
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
            <span aria-hidden className="pointer-events-none absolute -left-11 top-4 w-40 -rotate-45 bg-premium py-0.5 text-center text-[9px] font-bold uppercase tracking-[0.18em] text-premium-foreground shadow-md">
              Sponsored
            </span>
            <AdChip className={cn("absolute right-3 top-3 bg-background/85 text-foreground backdrop-blur-sm", onImage && "bg-black/40 text-white")} />

            <span
              key={b.id}
              className={cn(
                "animate-banner-in relative flex max-w-2xl flex-col justify-center gap-2 px-6 pb-5 pt-11 sm:px-16 sm:py-6",
                onImage ? "text-white" : "text-foreground",
                // Room for the video buttons in the bottom corner on phones.
                b.videoUrl && "pb-14",
              )}
            >
              <span className="text-xl font-black uppercase leading-tight tracking-tight sm:text-3xl">{b.title}</span>
              <span aria-hidden className="h-0.5 w-12 rounded-full bg-premium" />
              {b.subtitle && <span className={cn("line-clamp-2 max-w-lg text-sm", onImage ? "text-white/85" : "text-muted-foreground")}>{b.subtitle}</span>}
              <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-0.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-premium px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-premium-foreground shadow-md transition-transform group-hover:translate-x-0.5">
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

        {b.videoUrl && (
          <div className="absolute bottom-3 right-3 flex gap-1.5">
            <VideoButton onClick={togglePlay} label={videoPlaying ? "Pause video" : "Play video"}>
              {videoPlaying ? (
                <path fill="currentColor" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
              ) : (
                <path fill="currentColor" d="M8 5.5v13l11-6.5z" />
              )}
            </VideoButton>
            <VideoButton
              onClick={() => {
                setMuted((m) => !m);
                // Turning the sound on also starts a paused clip.
                if (muted && videoRef.current?.paused) void videoRef.current.play().catch(() => {});
              }}
              label={muted ? "Turn sound on" : "Turn sound off"}
              pressed={!muted}
            >
              <path fill="currentColor" d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
              {muted ? (
                <path d="M15.5 9.5l5 5m0-5l-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
              ) : (
                <path d="M15 9a4 4 0 010 6m2.5-8.5a7.5 7.5 0 010 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
              )}
            </VideoButton>
          </div>
        )}

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
              onClick={() => go(i - current)}
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
        "absolute top-1/2 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full bg-background/85 text-lg text-foreground shadow-md ring-1 ring-premium/40 backdrop-blur-sm transition-colors hover:bg-premium hover:text-premium-foreground sm:flex",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      <span aria-hidden>{side === "left" ? "‹" : "›"}</span>
    </button>
  );
}

function VideoButton({ onClick, label, pressed, children }: { onClick: () => void; label: string; pressed?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      className="flex size-8 items-center justify-center rounded-full bg-black/55 text-white shadow-md ring-1 ring-premium/50 backdrop-blur-sm transition-colors hover:bg-premium hover:text-premium-foreground"
    >
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
        {children}
      </svg>
    </button>
  );
}
