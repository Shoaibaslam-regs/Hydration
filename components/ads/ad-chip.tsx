import { cn } from "@/lib/utils";

/**
 * The small boxed "Ad" marker (like search engines use) that tells people a
 * placement is paid. Inherits the text color, so it works on photos and cards.
 */
export function AdChip({ className }: { className?: string }) {
  return (
    <span
      title="Paid advertisement"
      className={cn("inline-flex h-5 shrink-0 items-center rounded border border-current px-1.5 text-[11px] font-bold leading-none tracking-wide", className)}
    >
      Ad
    </span>
  );
}
