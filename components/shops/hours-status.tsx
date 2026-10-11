import { cn } from "@/lib/utils";

const Clock = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

/**
 * Opening-hours status, sized to be noticed: a pill ("Open now · until 21:00"
 * / "Closed now · opens 08:00"). Pass `open` computed with isOpenAt() at
 * request time.
 */
export function HoursPill({ open, hours, size = "md", className }: { open: boolean; hours: { opensAt: string; closesAt: string }; size?: "sm" | "md"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full font-semibold ring-1",
        size === "md" ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs",
        open ? "bg-success/15 text-success ring-success/30" : "bg-danger/10 text-danger ring-danger/30",
        className,
      )}
    >
      <Clock className={size === "md" ? "size-4" : "size-3.5"} />
      {open ? `Open now · until ${hours.closesAt}` : `Closed now · opens ${hours.opensAt}`}
    </span>
  );
}

/** A clear notice above the order box when the shop is outside its hours. Ordering still works. */
export function ClosedHoursNotice({ hours }: { hours: { opensAt: string; closesAt: string } }) {
  return (
    <div role="status" className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 p-4">
      <Clock className="mt-0.5 size-6 shrink-0 text-danger" />
      <div>
        <p className="text-base font-bold text-danger">Closed right now</p>
        <p className="text-sm">
          Opens at <span className="font-semibold">{hours.opensAt}</span> (open {hours.opensAt}–{hours.closesAt}).
        </p>
        <p className="mt-1 text-xs text-muted-foreground">You can still place an order. The shop will confirm it when it opens.</p>
      </div>
    </div>
  );
}
