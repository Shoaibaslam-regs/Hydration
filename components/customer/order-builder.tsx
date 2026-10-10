"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CAN_LABEL, formatPrice, MAX_CANS_PER_ORDER } from "@/lib/catalog";

/** How many 19L cans to order; "Order now" carries the count to checkout in the URL. */
export function OrderBuilder({ shopSlug, pricePerCan, deliveryFee }: { shopSlug: string; pricePerCan: number; deliveryFee: number }) {
  const router = useRouter();
  const [cans, setCans] = useState(1);
  const set = (n: number) => setCans(Math.max(1, Math.min(MAX_CANS_PER_ORDER, n)));
  const subtotal = pricePerCan * cans;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">{CAN_LABEL}</p>
        <p>
          <span className="text-xl font-bold">{formatPrice(pricePerCan)}</span>
          <span className="text-sm text-muted-foreground"> per can</span>
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2" role="group" aria-label="Number of cans">
          <Button variant="secondary" onClick={() => set(cans - 1)} disabled={cans <= 1} aria-label="One can fewer">
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
            className="h-10 w-16 rounded-lg border border-border bg-background text-center text-lg font-semibold tabular-nums"
          />
          <Button variant="secondary" onClick={() => set(cans + 1)} disabled={cans >= MAX_CANS_PER_ORDER} aria-label="One can more">
            +
          </Button>
          <span className="text-sm text-muted-foreground">{cans === 1 ? "can" : "cans"}</span>
        </div>
        <div className="text-right text-sm" aria-live="polite">
          <p className="text-lg font-semibold">{formatPrice(subtotal + deliveryFee)}</p>
          <p className="text-muted-foreground">
            {formatPrice(subtotal)} + {deliveryFee === 0 ? "free delivery" : `${formatPrice(deliveryFee)} delivery`}
          </p>
        </div>
      </div>
      <Button size="lg" onClick={() => router.push(`/account/checkout?shop=${encodeURIComponent(shopSlug)}&cans=${cans}`)}>
        Order {cans} {cans === 1 ? "can" : "cans"}
      </Button>
      <p className="text-xs text-muted-foreground">Pay cash on delivery.</p>
    </div>
  );
}
