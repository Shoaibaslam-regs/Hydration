"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CAN_LABEL, formatPrice, MAX_CANS_PER_ORDER } from "@/lib/catalog";
import { cn } from "@/lib/utils";

const QUICK_PICKS = [1, 2, 3, 5];

/** How many 19L cans to order; "Order" carries the count to checkout in the URL. */
export function OrderBuilder({ shopSlug, pricePerCan, deliveryFee }: { shopSlug: string; pricePerCan: number; deliveryFee: number }) {
  const router = useRouter();
  const [cans, setCans] = useState(1);
  const [pending, setPending] = useState(false);
  const set = (n: number) => setCans(Math.max(1, Math.min(MAX_CANS_PER_ORDER, n)));
  const subtotal = pricePerCan * cans;

  function order() {
    setPending(true);
    router.push(`/account/checkout?shop=${encodeURIComponent(shopSlug)}&cans=${cans}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
            <path d="M9 2.5h6M10 2.5v2.5h4V2.5M7.5 7.5c0-1.4 1.1-2.5 2.5-2.5h4c1.4 0 2.5 1.1 2.5 2.5V20a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 7.5 20z" />
            <path d="M7.5 11.5h9M7.5 16h9" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{CAN_LABEL}</p>
          <p className="text-sm text-muted-foreground">
            <span className="text-lg font-bold text-foreground">{formatPrice(pricePerCan)}</span> per can
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium" id="cans-label">
          How many cans?
        </p>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-2" role="group" aria-labelledby="cans-label">
          <Button variant="secondary" size="lg" onClick={() => set(cans - 1)} disabled={cans <= 1} aria-label="One can fewer" className="w-12 px-0 text-xl">
            −
          </Button>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_CANS_PER_ORDER}
            value={cans}
            onChange={(e) => set(Number(e.target.value) || 1)}
            aria-label="Cans"
            className="h-12 w-20 bg-transparent text-center text-3xl font-bold tabular-nums outline-none"
          />
          <Button variant="secondary" size="lg" onClick={() => set(cans + 1)} disabled={cans >= MAX_CANS_PER_ORDER} aria-label="One can more" className="w-12 px-0 text-xl">
            +
          </Button>
        </div>
        <div className="flex gap-2" aria-label="Quick choices">
          {QUICK_PICKS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => set(n)}
              aria-pressed={cans === n}
              className={cn(
                "flex-1 rounded-lg border py-1.5 text-sm font-medium transition-colors",
                cans === n ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary hover:text-primary",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-y-1.5 rounded-xl bg-muted/60 p-3 text-sm" aria-live="polite">
        <dt className="text-muted-foreground">
          {cans} × {formatPrice(pricePerCan)}
        </dt>
        <dd className="text-right">{formatPrice(subtotal)}</dd>
        <dt className="text-muted-foreground">Delivery</dt>
        <dd className="text-right">{deliveryFee === 0 ? <span className="font-medium text-success">Free</span> : formatPrice(deliveryFee)}</dd>
        <dt className="border-t border-border pt-1.5 font-semibold">Total</dt>
        <dd className="border-t border-border pt-1.5 text-right text-lg font-bold">{formatPrice(subtotal + deliveryFee)}</dd>
      </dl>

      <Button size="lg" onClick={order} disabled={pending} className="w-full text-base">
        {pending ? "Opening checkout…" : `Order ${cans} ${cans === 1 ? "can" : "cans"} · ${formatPrice(subtotal + deliveryFee)}`}
      </Button>
      <p className="-mt-2 text-center text-xs text-muted-foreground">💵 Pay cash when your water arrives</p>
    </div>
  );
}
