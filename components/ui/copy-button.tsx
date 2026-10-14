"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** A labelled "Copy" button for a value (an IBAN, an account title…). */
export function CopyButton({ value, label, className }: { value: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (e.g. plain-HTTP LAN dev): the text is still selectable.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label}`}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground hover:border-primary hover:text-primary",
        className,
      )}
    >
      {copied ? (
        <span aria-hidden className="text-success">✓</span>
      ) : (
        <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="9" y="9" width="12" height="12" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      )}
      {copied ? "Copied" : "Copy"}
      <span role="status" className="sr-only">
        {copied ? `${label} copied` : ""}
      </span>
    </button>
  );
}
