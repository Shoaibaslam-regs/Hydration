"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPrice, PRODUCT_TYPE_LABELS } from "@/lib/catalog";
import { encodeCart, MAX_LINE_QUANTITY } from "@/lib/orders/cart";
import type { ProductSummary } from "@/lib/services/shops";

/** Product list with quantity steppers; "Checkout" carries the cart in the URL. */
export function OrderBuilder({
  shopSlug,
  products,
  deliveryFee,
}: {
  shopSlug: string;
  products: ProductSummary[];
  deliveryFee: number;
}) {
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, number>>({});

  const set = (id: string, n: number) => setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(MAX_LINE_QUANTITY, n)) }));
  const lines = products.filter((p) => (qty[p.id] ?? 0) > 0);
  const subtotal = lines.reduce((sum, p) => sum + p.price * qty[p.id], 0);
  const count = lines.reduce((n, p) => n + qty[p.id], 0);

  function checkout() {
    const items = encodeCart(lines.map((p) => ({ productId: p.id, quantity: qty[p.id] })));
    router.push(`/account/checkout?shop=${encodeURIComponent(shopSlug)}&items=${items}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="grid gap-3 sm:grid-cols-2">
        {products.map((p) => {
          const n = qty[p.id] ?? 0;
          return (
            <li key={p.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{p.name}</p>
                <span className="shrink-0 font-semibold">{formatPrice(p.price)}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone="info">{PRODUCT_TYPE_LABELS[p.type]}</Badge>
                {p.sizeLiters !== null && <Badge>{p.sizeLiters} L</Badge>}
                {!p.inStock && <Badge tone="danger">Out of stock</Badge>}
              </div>
              {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
              <div className="mt-auto flex items-center justify-end gap-2" role="group" aria-label={`Quantity of ${p.name}`}>
                {n > 0 ? (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => set(p.id, n - 1)} aria-label={`Remove one ${p.name}`}>
                      −
                    </Button>
                    <span className="w-8 text-center font-semibold tabular-nums" aria-live="polite">
                      {n}
                    </span>
                    <Button variant="secondary" size="sm" onClick={() => set(p.id, n + 1)} aria-label={`Add one ${p.name}`}>
                      +
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => set(p.id, 1)} disabled={!p.inStock}>
                    Add
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {count > 0 && (
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary bg-card p-4 shadow-lg">
          <div className="text-sm">
            <p className="font-semibold">
              {count} {count === 1 ? "item" : "items"} · {formatPrice(subtotal)}
            </p>
            <p className="text-muted-foreground">
              + {deliveryFee === 0 ? "free delivery" : `${formatPrice(deliveryFee)} delivery`}
            </p>
          </div>
          <Button size="lg" onClick={checkout}>
            Checkout
          </Button>
        </div>
      )}
    </div>
  );
}
