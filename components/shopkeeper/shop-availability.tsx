"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/auth/form-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api/client";
import { formatDateTime } from "@/lib/catalog";
import type { MyShop } from "@/lib/services/my-shop";

/** Lets a shopkeeper temporarily close their shop and reopen it. */
export function ShopAvailability({ shop }: { shop: MyShop }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closure = shop.closure;

  async function send(body: { action: "close"; reason: string } | { action: "reopen" }) {
    setPending(true);
    setError(null);
    const result = await apiRequest("/api/shopkeeper/shop/closure", { body });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setAsking(false);
    setReason("");
    router.refresh();
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Availability</CardTitle>
        <Badge tone={closure ? "danger" : "success"}>{closure ? "Closed" : "Open for orders"}</Badge>
      </div>
      <FormError message={error} />

      {!closure && !asking && (
        <>
          <CardDescription>
            Closing your shop hides it from search and stops new orders. Orders already placed stay in your list, so you can
            still deliver them. You can reopen any time.
          </CardDescription>
          <Button variant="danger-outline" className="self-start" onClick={() => setAsking(true)}>
            Close shop
          </Button>
        </>
      )}

      {!closure && asking && (
        <>
          <Field label="Note for customers (optional)" hint="Shown on your shop page, e.g. “Closed for Eid, back on Monday”.">
            {(p) => <Input {...p} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} autoFocus />}
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" onClick={() => send({ action: "close", reason: reason.trim() })} disabled={pending}>
              {pending ? "Closing…" : "Close shop"}
            </Button>
            <Button variant="ghost" onClick={() => setAsking(false)} disabled={pending}>
              Cancel
            </Button>
          </div>
        </>
      )}

      {closure?.by === "shopkeeper" && (
        <>
          <CardDescription>
            You closed your shop on {formatDateTime(closure.at)}
            {closure.reason && <> (“{closure.reason}”)</>}. Customers can&apos;t find it or place new orders.
          </CardDescription>
          <Button className="self-start" onClick={() => send({ action: "reopen" })} disabled={pending}>
            {pending ? "Reopening…" : "Reopen shop"}
          </Button>
        </>
      )}

      {closure?.by === "admin" && (
        <CardDescription>
          The Aqua team closed your shop on {formatDateTime(closure.at)}
          {closure.reason && <>. Reason: {closure.reason}</>}. Contact support to reopen it.
        </CardDescription>
      )}
    </Card>
  );
}
