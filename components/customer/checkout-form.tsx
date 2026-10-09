"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/auth/form-error";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api/client";
import { formatDistance } from "@/lib/catalog";
import { distanceKm, type LatLng } from "@/lib/geo";
import type { SavedAddress } from "@/lib/services/addresses";
import { cn } from "@/lib/utils";

export function CheckoutForm({
  shop,
  items,
  addresses,
  defaultPhone,
  returnPath,
}: {
  shop: { slug: string; name: string; location: LatLng; deliveryRadiusKm: number };
  items: { productId: string; quantity: number }[];
  addresses: SavedAddress[];
  defaultPhone: string;
  returnPath: string;
}) {
  const router = useRouter();
  const withDistance = addresses.map((a) => {
    const km = distanceKm(shop.location, a.location);
    return { ...a, km, inRange: km <= shop.deliveryRadiusKm };
  });
  const firstUsable = withDistance.find((a) => a.isDefault && a.inRange) ?? withDistance.find((a) => a.inRange);
  const [addressId, setAddressId] = useState<string | null>(firstUsable?.id ?? null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const addAddressHref = `/account/addresses/new?next=${encodeURIComponent(returnPath)}`;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!addressId) {
      setError("Choose a delivery address.");
      return;
    }
    setPending(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    const result = await apiRequest<{ id: string }>("/api/customer/orders", {
      body: {
        shopSlug: shop.slug,
        items,
        addressId,
        contactPhone: String(f.get("contactPhone") ?? ""),
        notes: String(f.get("notes") ?? ""),
      },
    });
    if (!result.ok) {
      setPending(false);
      setError(result.message);
      setFieldErrors(result.fieldErrors);
      return;
    }
    router.replace(`/account/orders/${result.data.id}?placed=1`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <FormError message={error} />
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Deliver to</CardTitle>
          <Link href={addAddressHref} className="text-sm font-medium text-primary hover:underline">
            + New address
          </Link>
        </div>
        {withDistance.length === 0 ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-muted-foreground">Add a delivery address to continue.</p>
            <Link href={addAddressHref} className={buttonClasses()}>
              Add address
            </Link>
          </div>
        ) : (
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Delivery address</legend>
            {withDistance.map((a) => (
              <label
                key={a.id}
                className={cn(
                  "flex gap-3 rounded-lg border p-3 text-sm",
                  !a.inRange && "cursor-not-allowed opacity-60",
                  a.inRange && "cursor-pointer",
                  addressId === a.id ? "border-primary bg-accent" : "border-border",
                )}
              >
                <input
                  type="radio"
                  name="address"
                  value={a.id}
                  checked={addressId === a.id}
                  onChange={() => setAddressId(a.id)}
                  disabled={!a.inRange}
                  className="mt-1 accent-[var(--primary)]"
                />
                <span className="flex flex-col">
                  <span className="font-medium">{a.label}</span>
                  <span className="text-muted-foreground">{[a.line1, a.area, a.city].filter(Boolean).join(", ")}</span>
                  <span className={a.inRange ? "text-muted-foreground" : "text-danger"}>
                    {formatDistance(a.km)} from the shop
                    {!a.inRange && ` · outside its ${shop.deliveryRadiusKm} km delivery area`}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {fieldErrors.addressId?.[0] && <p className="text-sm text-danger">{fieldErrors.addressId[0]}</p>}
      </Card>

      <Card className="flex flex-col gap-4">
        <CardTitle>Contact</CardTitle>
        <Field label="Phone number for the delivery" error={fieldErrors.contactPhone?.[0]}>
          {(p) => <Input {...p} name="contactPhone" type="tel" defaultValue={defaultPhone} autoComplete="tel" required />}
        </Field>
        <Field label="Note for the shop (optional)" error={fieldErrors.notes?.[0]}>
          {(p) => <Input {...p} name="notes" maxLength={300} placeholder="e.g. Please call when outside" />}
        </Field>
      </Card>

      <Button type="submit" size="lg" disabled={pending || !addressId}>
        {pending ? "Placing order…" : `Place order with ${shop.name}`}
      </Button>
      <p className="text-center text-xs text-muted-foreground">You pay cash on delivery.</p>
    </form>
  );
}
