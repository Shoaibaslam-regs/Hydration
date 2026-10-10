"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { apiRequest } from "@/lib/api/client";
import { BILLING_MONTH_OPTIONS, PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/lib/billing/constants";
import { formatPrice } from "@/lib/catalog";
import { PLANS } from "@/lib/plans";

/** Report a subscription payment made outside the site. The server recomputes the amount. */
export function PaymentForm() {
  const router = useRouter();
  const plan = PLANS[0];
  const [months, setMonths] = useState<number>(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const result = await apiRequest("/api/shopkeeper/billing", {
      body: { planId: plan.id, months, method: f.get("method"), reference: f.get("reference"), note: f.get("note") },
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      setFieldErrors(result.fieldErrors);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={`Months (${formatPrice(plan.monthlyPrice)} each)`} error={fieldErrors.months?.[0] ?? fieldErrors.planId?.[0]}>
          {(p) => (
            <Select {...p} value={months} onChange={(e) => setMonths(Number(e.target.value))}>
              {BILLING_MONTH_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m} {m === 1 ? "month" : "months"}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="How you paid" error={fieldErrors.method?.[0]}>
          {(p) => (
            <Select {...p} name="method" defaultValue="bank_transfer">
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Transaction ID / receipt number" error={fieldErrors.reference?.[0]}>
          {(p) => <Input {...p} name="reference" required maxLength={100} autoComplete="off" />}
        </Field>
      </div>
      <Field label="Note (optional)" hint="e.g. the account name you paid from." error={fieldErrors.note?.[0]}>
        {(p) => <Input {...p} name="note" maxLength={500} />}
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted p-3">
        <span className="text-sm">
          Amount to pay: <span className="font-semibold">{formatPrice(plan.monthlyPrice * months)}</span>
        </span>
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send for review"}
        </Button>
      </div>
    </form>
  );
}
