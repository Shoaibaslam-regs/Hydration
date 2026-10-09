"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import { apiRequest } from "@/lib/api/client";
import { REASON_REQUIRED, SHOPKEEPER_ACTION_LABELS, type OrderStatus } from "@/lib/orders/status";

export function OrderActions({ orderId, nextStatuses }: { orderId: string; nextStatuses: OrderStatus[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<OrderStatus | null>(null);
  const [needsReason, setNeedsReason] = useState<OrderStatus | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (nextStatuses.length === 0) return null;

  async function move(status: OrderStatus) {
    if (REASON_REQUIRED.includes(status) && needsReason !== status) {
      setNeedsReason(status);
      setError(null);
      return;
    }
    setPending(status);
    setError(null);
    const result = await apiRequest(`/api/shopkeeper/orders/${orderId}`, {
      method: "PATCH",
      body: { status, note: note.trim() || undefined },
    });
    setPending(null);
    if (!result.ok) {
      setError(result.fieldErrors.note?.[0] ?? result.message);
      return;
    }
    setNeedsReason(null);
    setNote("");
    router.refresh();
  }

  const primary = nextStatuses.filter((s) => !REASON_REQUIRED.includes(s));
  const destructive = nextStatuses.filter((s) => REASON_REQUIRED.includes(s));

  return (
    <div className="flex flex-col gap-3">
      <FormError message={error} />
      {needsReason && (
        <Field label={`Reason (shown to the customer)`}>
          {(p) => (
            <Textarea
              {...p}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              placeholder="e.g. Out of stock for this size today"
              autoFocus
            />
          )}
        </Field>
      )}
      <div className="flex flex-wrap gap-2">
        {needsReason ? (
          <>
            <Button variant="danger" onClick={() => move(needsReason)} disabled={pending !== null || note.trim() === ""}>
              {pending ? "Saving…" : `Confirm: ${SHOPKEEPER_ACTION_LABELS[needsReason]}`}
            </Button>
            <Button variant="ghost" onClick={() => setNeedsReason(null)} disabled={pending !== null}>
              Back
            </Button>
          </>
        ) : (
          <>
            {primary.map((s) => (
              <Button key={s} onClick={() => move(s)} disabled={pending !== null}>
                {pending === s ? "Saving…" : SHOPKEEPER_ACTION_LABELS[s]}
              </Button>
            ))}
            {destructive.map((s) => (
              <Button key={s} variant="danger-outline" onClick={() => move(s)} disabled={pending !== null}>
                {SHOPKEEPER_ACTION_LABELS[s]}
              </Button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
