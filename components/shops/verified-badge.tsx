import { cn } from "@/lib/utils";

/**
 * Admin-granted trust mark. Label plus icon (never icon alone), with a tooltip
 * explaining what it means.
 */
export function VerifiedBadge({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span
      title="Verified by the Aqua team"
      className={cn("inline-flex shrink-0 items-center gap-1 text-primary", compact ? "text-xs" : "text-sm", className)}
    >
      <svg viewBox="0 0 24 24" className={compact ? "size-4" : "size-5"} aria-hidden>
        <path
          fill="currentColor"
          d="M12 1.5l2.4 1.9 3-.3.9 2.9 2.7 1.4-.6 3 1.6 2.6-2 2.3.2 3-2.9.9-1.2 2.8-3-.4L12 22.5l-2.4-1.9-3 .4-1.2-2.8-2.9-.9.2-3-2-2.3 1.6-2.6-.6-3L4.4 5l.9-2.9 3 .3z"
        />
        <path d="M8 12.3l2.6 2.6L16.2 9.3" fill="none" stroke="var(--primary-foreground)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="font-medium">Verified</span>
    </span>
  );
}
