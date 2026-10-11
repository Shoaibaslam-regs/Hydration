import { cn } from "@/lib/utils";

function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"
      />
    </svg>
  );
}

/**
 * Admin-given "Star shop" award: a violet pill (never gold, which means a paid
 * placement). Label plus icon, with a tooltip saying who gave it.
 */
export function StarShopBadge({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span
      title="Star shop: awarded by the Aqua team for outstanding service"
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-award font-semibold text-award-foreground shadow-sm",
        compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs",
        className,
      )}
    >
      <StarIcon className={compact ? "size-3" : "size-3.5"} />
      Star shop
    </span>
  );
}

/** A shop's "Star customer" tag on one of its regulars. */
export function StarCustomerBadge({ className, label = "Star customer" }: { className?: string; label?: string }) {
  return (
    <span
      title="Tagged by the shop as one of its regular customers"
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-award/40 bg-award-soft px-2 py-0.5 text-[11px] font-semibold text-award",
        className,
      )}
    >
      <StarIcon className="size-3" />
      {label}
    </span>
  );
}
