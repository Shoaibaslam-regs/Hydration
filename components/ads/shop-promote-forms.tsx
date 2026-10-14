"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { MAX_DEAL_DAYS, SPONSOR_PLAN_MONTHLY_PRICE, SPONSOR_PLAN_MONTHS, type SponsorPlanMonths } from "@/lib/ads/constants";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { apiRequest } from "@/lib/api/client";
import { formatPrice } from "@/lib/catalog";
import { cn } from "@/lib/utils";

type Errors = Record<string, string[] | undefined>;

/**
 * The Sponsored plan card: a fixed monthly price, a choice of 1–3 months and
 * one button that sends the request to the Aqua team (a sponsorship request
 * for admins plus a Support message to follow up on payment).
 */
export function SponsorPlanCard({ paymentInfo, compact = false }: { paymentInfo: string; compact?: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [months, setMonths] = useState<SponsorPlanMonths>(1);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = SPONSOR_PLAN_MONTHLY_PRICE * months;

  async function request() {
    const ok = await confirm({
      title: `Request the Sponsored plan for ${months} ${months === 1 ? "month" : "months"}?`,
      message: `${formatPrice(total)} in total. The Aqua team gets your request and a message, and starts your sponsorship once your payment is confirmed.`,
      confirmLabel: "Send request",
    });
    if (!ok) return;
    setPending(true);
    setError(null);
    const result = await apiRequest("/api/shopkeeper/campaigns", { body: { months, note } });
    setPending(false);
    if (!result.ok) {
      setError(result.fieldErrors.months?.[0] ?? result.fieldErrors.note?.[0] ?? result.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="relative isolate flex flex-col gap-4 overflow-hidden rounded-2xl border-2 border-premium/50 bg-gradient-to-br from-premium-soft via-card to-card p-5 shadow-sm">
      <span aria-hidden className="pointer-events-none absolute -right-12 -top-12 -z-10 size-40 rounded-full bg-premium/20 blur-3xl" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-premium">★ Sponsored plan</p>
          <p className="mt-1 text-3xl font-black tracking-tight">
            {formatPrice(SPONSOR_PLAN_MONTHLY_PRICE)}
            <span className="text-base font-medium text-muted-foreground"> / month</span>
          </p>
        </div>
        <span className="rounded-full bg-premium px-3 py-1 text-xs font-bold text-premium-foreground shadow-sm">Get more customers</span>
      </div>

      <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
        {[
          "Top of search, above the other shops",
          "Gold “Sponsored” card that stands out",
          "Shown to customers you deliver to",
          "Views and clicks in your reports",
        ].map((t) => (
          <li key={t} className="flex items-start gap-2">
            <span aria-hidden className="mt-0.5 text-premium">✓</span>
            {t}
          </li>
        ))}
      </ul>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">How long?</legend>
        <div className="flex flex-wrap gap-2">
          {SPONSOR_PLAN_MONTHS.map((m) => (
            <label
              key={m}
              className={cn(
                "flex cursor-pointer flex-col rounded-xl border px-4 py-2 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-premium",
                months === m ? "border-premium bg-premium text-premium-foreground shadow-sm" : "border-border bg-card hover:border-premium/60",
              )}
            >
              <input type="radio" name="sponsor-months" value={m} checked={months === m} onChange={() => setMonths(m)} className="sr-only" />
              <span className="font-semibold">
                {m} {m === 1 ? "month" : "months"}
              </span>
              <span className={cn("text-xs", months === m ? "text-premium-foreground/85" : "text-muted-foreground")}>
                {formatPrice(SPONSOR_PLAN_MONTHLY_PRICE * m)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {!compact && (
        <>
          {paymentInfo && (
            <div className="rounded-xl border border-border bg-background/70 p-3 text-sm">
              <p className="mb-1 font-medium">How to pay</p>
              <p className="whitespace-pre-line text-muted-foreground">{paymentInfo}</p>
            </div>
          )}
          <Field label="Note for the team (optional)" hint="e.g. the transaction ID if you've already paid.">
            {(p) => <Input {...p} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />}
          </Field>
        </>
      )}

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="premium" onClick={request} disabled={pending}>
          {pending ? "Sending…" : `Request sponsorship · ${formatPrice(total)}`}
        </Button>
        <span className="text-xs text-muted-foreground">Sends your request and a message to the Aqua team. Starts once payment is confirmed.</span>
      </div>
    </div>
  );
}

const DEAL_DAYS = [1, 3, 7, 14, MAX_DEAL_DAYS];

export function DealForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Errors>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setPending(true);
    setError(null);
    const result = await apiRequest("/api/shopkeeper/deals", {
      body: { title: f.get("title"), description: f.get("description"), days: Number(f.get("days")) },
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      setFieldErrors(result.fieldErrors);
      return;
    }
    form.reset();
    setFieldErrors({});
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <FormError message={error} />
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <Field label="Deal" hint="Short and specific, e.g. “19L can PKR 220 this week”." error={fieldErrors.title?.[0]}>
          {(p) => <Input {...p} name="title" maxLength={80} required />}
        </Field>
        <Field label="Runs for" error={fieldErrors.days?.[0]}>
          {(p) => (
            <Select {...p} name="days" defaultValue="7">
              {DEAL_DAYS.map((d) => (
                <option key={d} value={d}>
                  {d} {d === 1 ? "day" : "days"}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label="Details (optional)" error={fieldErrors.description?.[0]}>
        {(p) => <Textarea {...p} name="description" maxLength={300} rows={2} />}
      </Field>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Posting…" : "Post deal"}
      </Button>
    </form>
  );
}
