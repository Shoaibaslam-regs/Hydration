"use client";

import { useState } from "react";
import { publicIdLabel } from "@/lib/ids";
import { cn } from "@/lib/utils";

/**
 * A public ID ("SK-4F7HQ2") in a small monospace chip, labelled with what it
 * is ("Shopkeeper ID", from the prefix, unless `label` overrides it or is
 * `false`), with a copy button. Renders nothing for an empty id (records
 * created before IDs existed).
 */
export function IdChip({ id, label, className }: { id: string; label?: string | false; className?: string }) {
  const [copied, setCopied] = useState(false);
  if (!id) return null;

  async function copy(e: React.MouseEvent) {
    // Chips often sit inside a clickable row: copy without following the link.
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (e.g. plain-HTTP LAN dev): the ID is still selectable.
    }
  }

  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs", className)}>
      {label !== false && <span className="text-muted-foreground">{label ?? publicIdLabel(id)}</span>}
      <span className="select-all font-mono font-semibold tracking-wide">{id}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${id}`}
        title={copied ? "Copied" : "Copy"}
        className="relative z-10 inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
      >
        {copied ? (
          <span aria-hidden className="text-success">✓</span>
        ) : (
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <rect x="9" y="9" width="12" height="12" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </svg>
        )}
      </button>
      <span role="status" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </span>
  );
}
