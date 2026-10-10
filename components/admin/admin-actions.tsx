"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Field, Textarea } from "@/components/ui/input";
import { apiRequest } from "@/lib/api/client";

export type AdminAction = {
  label: string;
  /** Request body; the reason (if any) is added under `reasonKey`. */
  body: Record<string, unknown>;
  needsReason?: boolean;
  danger?: boolean;
  confirm?: string;
};

/**
 * Buttons for admin mutations. Actions that need a reason open a textarea
 * first. After success the page re-renders with fresh server data.
 */
export function AdminActions({
  endpoint,
  actions,
  method = "PATCH",
  reasonKey = "reason",
  reasonHint,
  redirectTo,
}: {
  endpoint: string;
  actions: AdminAction[];
  method?: string;
  reasonKey?: string;
  reasonHint?: string;
  /** Navigate here after success instead of refreshing (e.g. after deleting the thing on screen). */
  redirectTo?: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, setPending] = useState(false);
  const [asking, setAsking] = useState<AdminAction | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (actions.length === 0) return null;

  async function run(action: AdminAction) {
    if (action.needsReason && asking !== action) {
      setAsking(action);
      setError(null);
      return;
    }
    if (action.confirm) {
      // Short questions make a good title; longer ones go under a "Label?" title.
      const long = action.confirm.length > 60;
      const ok = await confirm({
        title: long ? `${action.label}?` : action.confirm,
        message: long ? action.confirm : undefined,
        confirmLabel: action.label,
        tone: action.danger ? "danger" : "primary",
      });
      if (!ok) return;
    }
    setPending(true);
    setError(null);
    const body = action.needsReason ? { ...action.body, [reasonKey]: reason.trim() } : action.body;
    const result = await apiRequest(endpoint, { method, body });
    setPending(false);
    if (!result.ok) {
      setError(result.fieldErrors[reasonKey]?.[0] ?? result.message);
      return;
    }
    setAsking(null);
    setReason("");
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <FormError message={error} />
      {asking ? (
        <>
          <Field label={`Reason: ${asking.label.toLowerCase()}`} hint={reasonHint}>
            {(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} autoFocus />}
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button variant={asking.danger ? "danger" : "primary"} onClick={() => run(asking)} disabled={pending || reason.trim() === ""}>
              {pending ? "Saving…" : `Confirm: ${asking.label}`}
            </Button>
            <Button variant="ghost" onClick={() => setAsking(null)} disabled={pending}>
              Back
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button
              key={a.label}
              variant={a.danger ? "danger-outline" : "primary"}
              onClick={() => run(a)}
              disabled={pending}
            >
              {a.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
