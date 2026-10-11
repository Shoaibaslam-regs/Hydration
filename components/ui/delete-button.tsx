"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { apiRequest } from "@/lib/api/client";
import { cn } from "@/lib/utils";

/**
 * A small delete action: asks in the themed confirm dialog, sends a DELETE,
 * then refreshes (or navigates to `redirectTo`). `variant="icon"` is a quiet
 * "×" for list rows. For deletions that need a reason, use AdminActions.
 */
export function DeleteButton({
  endpoint,
  body,
  label = "Delete",
  confirmTitle,
  confirmMessage,
  confirmLabel = "Delete",
  variant = "button",
  redirectTo,
  className,
}: {
  endpoint: string;
  body?: Record<string, unknown>;
  label?: string;
  confirmTitle: string;
  confirmMessage?: string;
  confirmLabel?: string;
  variant?: "button" | "link" | "icon";
  redirectTo?: string;
  className?: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!(await confirm({ title: confirmTitle, message: confirmMessage, confirmLabel, tone: "danger" }))) return;
    setPending(true);
    setError(null);
    const result = await apiRequest(endpoint, { method: "DELETE", body: body ?? {} });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }

  return (
    <span className={cn("inline-flex flex-col items-start gap-1", className)}>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={run}
          disabled={pending}
          aria-label={label}
          title={label}
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
          </svg>
        </button>
      ) : variant === "link" ? (
        <button type="button" onClick={run} disabled={pending} className="text-sm font-medium text-danger hover:underline disabled:opacity-50">
          {pending ? "Deleting…" : label}
        </button>
      ) : (
        <Button variant="danger-outline" size="sm" onClick={run} disabled={pending}>
          {pending ? "Deleting…" : label}
        </Button>
      )}
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
