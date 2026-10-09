"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { apiRequest } from "@/lib/api/client";
import { CURRENCY, fromMinorUnits, PRODUCT_TYPE_LABELS, PRODUCT_TYPES } from "@/lib/catalog";
import type { MyProduct } from "@/lib/services/my-products";

export function ProductForm({ product }: { product: MyProduct | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const err = (k: string) => fieldErrors[k]?.[0];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    const str = (k: string) => String(f.get(k) ?? "").trim();
    const num = (k: string) => (str(k) === "" ? NaN : Number(str(k)));

    const result = await apiRequest<MyProduct>(
      product ? `/api/shopkeeper/products/${product.id}` : "/api/shopkeeper/products",
      {
        method: product ? "PATCH" : "POST",
        body: {
          name: str("name"),
          type: str("type"),
          description: str("description"),
          sizeLiters: str("sizeLiters") === "" ? null : num("sizeLiters"),
          price: num("price"),
          stock: num("stock"),
          isActive: f.get("isActive") === "on",
        },
      },
    );
    if (!result.ok) {
      setPending(false);
      setError(result.message);
      setFieldErrors(result.fieldErrors);
      return;
    }
    router.push("/shop/products");
    router.refresh();
  }

  async function onDelete() {
    if (!product || !confirm(`Delete "${product.name}"? This can't be undone.`)) return;
    setDeleting(true);
    const result = await apiRequest(`/api/shopkeeper/products/${product.id}`, { method: "DELETE" });
    if (!result.ok) {
      setDeleting(false);
      setError(result.message);
      return;
    }
    router.push("/shop/products");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <FormError message={error} />
      <Card className="flex flex-col gap-4">
        <Field label="Product name" error={err("name")}>
          {(p) => <Input {...p} name="name" defaultValue={product?.name} placeholder="e.g. 19L water can" required maxLength={120} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type" error={err("type")}>
            {(p) => (
              <Select {...p} name="type" defaultValue={product?.type ?? "can"}>
                {PRODUCT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {PRODUCT_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Size in liters (optional)" error={err("sizeLiters")}>
            {(p) => <Input {...p} name="sizeLiters" type="number" min={0} step="any" defaultValue={product?.sizeLiters ?? ""} />}
          </Field>
          <Field label={`Price (${CURRENCY})`} error={err("price")}>
            {(p) => (
              <Input {...p} name="price" type="number" min={0} step="any" required defaultValue={product ? fromMinorUnits(product.price) : ""} />
            )}
          </Field>
          <Field label="Units in stock" error={err("stock")}>
            {(p) => <Input {...p} name="stock" type="number" min={0} step={1} required defaultValue={product?.stock ?? 0} />}
          </Field>
        </div>
        <Field label="Description (optional)" error={err("description")}>
          {(p) => <Textarea {...p} name="description" defaultValue={product?.description} maxLength={1000} />}
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={product?.isActive ?? true} className="size-4 accent-[var(--primary)]" />
          Show this product to customers
        </label>
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {product ? (
          <Button variant="ghost" onClick={onDelete} disabled={deleting || pending} className="text-danger">
            {deleting ? "Deleting…" : "Delete product"}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" size="lg" disabled={pending || deleting}>
          {pending ? "Saving…" : product ? "Save changes" : "Add product"}
        </Button>
      </div>
    </form>
  );
}
