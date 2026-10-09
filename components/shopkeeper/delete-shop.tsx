"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api/client";

/** Permanent deletion, guarded by typing the shop's name. */
export function DeleteShop({ shopName }: { shopName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim().toLowerCase() === shopName.trim().toLowerCase();

  async function remove() {
    setPending(true);
    setError(null);
    const result = await apiRequest("/api/shopkeeper/shop", { method: "DELETE", body: { confirmName: typed } });
    if (!result.ok) {
      setPending(false);
      setError(result.fieldErrors.confirmName?.[0] ?? result.message);
      return;
    }
    router.push("/shop");
    router.refresh();
  }

  return (
    <Card className="flex flex-col gap-3 border-danger/40">
      <CardTitle>Delete shop</CardTitle>
      <CardDescription>
        Permanently removes your shop, its products and reviews. Any orders that aren&apos;t finished yet are cancelled and
        customers are told the shop has closed. Your account and past order records are kept. To take a break instead,
        close your shop from the Overview page.
      </CardDescription>
      <FormError message={error} />
      {open ? (
        <>
          <Field label={`Type “${shopName}” to confirm`}>
            {(p) => <Input {...p} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus />}
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" onClick={remove} disabled={!matches || pending}>
              {pending ? "Deleting…" : "Delete my shop permanently"}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <Button variant="danger-outline" className="self-start" onClick={() => setOpen(true)}>
          Delete shop…
        </Button>
      )}
    </Card>
  );
}
