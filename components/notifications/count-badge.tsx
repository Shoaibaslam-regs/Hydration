import { cn } from "@/lib/utils";

/** A small number bubble (99+ max). Renders nothing for 0. */
export function CountBadge({ count, label, className }: { count: number; label: string; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-semibold leading-none text-white tabular-nums",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
      <span className="sr-only"> {label}</span>
    </span>
  );
}

/** A plain dot for "something new" where a number would be too busy. */
export function NotificationDot({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn("inline-block size-2.5 rounded-full bg-danger ring-2 ring-background", className)}>
      <span className="sr-only">{label}</span>
    </span>
  );
}
