import { formatCountdown } from "./use-lockout";

/** Shown while a form is locked after too many failed attempts. */
export function LockoutNotice({ secondsLeft }: { secondsLeft: number }) {
  if (secondsLeft <= 0) return null;
  return (
    <div role="alert" className="flex items-center gap-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm">
      <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-danger" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
        <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
        <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      </svg>
      <span>
        <span className="font-semibold text-danger">Too many failed attempts.</span> For your security, please wait{" "}
        <span className="font-mono font-semibold tabular-nums" aria-live="off">
          {formatCountdown(secondsLeft)}
        </span>{" "}
        before trying again.
      </span>
    </div>
  );
}
