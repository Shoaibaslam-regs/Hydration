"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/auth/form-error";
import { LocationPicker } from "@/components/map/location-picker";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { apiRequest } from "@/lib/api/client";
import { CAN_LABEL, CURRENCY, fromMinorUnits } from "@/lib/catalog";
import type { LatLng } from "@/lib/geo";
import type { MyShop } from "@/lib/services/my-shop";

type Errors = Record<string, string[] | undefined>;

export function ShopProfileForm({ shop }: { shop: MyShop | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Errors>({});
  const [location, setLocation] = useState<LatLng | null>(shop ? shop.location : null);

  const err = (key: string) => fieldErrors[key]?.[0];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    const f = new FormData(e.currentTarget);
    const str = (k: string) => String(f.get(k) ?? "");
    const num = (v: string) => (v.trim() === "" ? NaN : Number(v));
    if (!location) {
      setPending(false);
      setFieldErrors({ location: ["Set your shop's location on the map"] });
      setError("Please fix the highlighted fields.");
      return;
    }

    const result = await apiRequest<MyShop>("/api/shopkeeper/shop", {
      method: shop ? "PUT" : "POST",
      body: {
        name: str("name"),
        description: str("description"),
        phone: str("phone"),
        address: { line1: str("line1"), area: str("area"), city: str("city") },
        location,
        deliveryRadiusKm: num(str("deliveryRadiusKm")),
        deliveryFee: num(str("deliveryFee")),
        pricePerCan: num(str("pricePerCan")),
        hours: { opensAt: str("opensAt"), closesAt: str("closesAt") },
      },
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    if (shop) {
      setSaved(true);
      router.refresh();
    } else {
      router.push("/shop");
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <FormError message={error} />

      <Card className="flex flex-col gap-4">
        <CardTitle>About your shop</CardTitle>
        <Field label="Shop name" error={err("name")}>
          {(p) => <Input {...p} name="name" defaultValue={shop?.name} required maxLength={120} />}
        </Field>
        <Field label="Description (optional)" hint="What makes your water or service special?" error={err("description")}>
          {(p) => <Textarea {...p} name="description" defaultValue={shop?.description} maxLength={2000} />}
        </Field>
        <Field label="Phone for orders" error={err("phone")}>
          {(p) => <Input {...p} name="phone" type="tel" defaultValue={shop?.phone} required />}
        </Field>
      </Card>

      <Card className="flex flex-col gap-4">
        <CardTitle>Address & location</CardTitle>
        <Field label="Street address" error={err("address.line1")}>
          {(p) => <Input {...p} name="line1" defaultValue={shop?.address.line1} required autoComplete="street-address" />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Area / neighborhood" error={err("address.area")}>
            {(p) => <Input {...p} name="area" defaultValue={shop?.address.area} />}
          </Field>
          <Field label="City" error={err("address.city")}>
            {(p) => <Input {...p} name="city" defaultValue={shop?.address.city} required autoComplete="address-level2" />}
          </Field>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Map location</p>
          <CardDescription>Customers find you by distance, so pin your shop&apos;s exact spot.</CardDescription>
          <LocationPicker
            value={location}
            onChange={setLocation}
            error={err("location") ?? err("location.lat") ?? err("location.lng")}
          />
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <CardTitle>Price, delivery & hours</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={`Price per ${CAN_LABEL} (${CURRENCY})`}
            hint="Customers order by the can at this price."
            error={err("pricePerCan")}
            className="sm:col-span-2"
          >
            {(p) => (
              <Input
                {...p}
                name="pricePerCan"
                type="number"
                min={1}
                step="any"
                inputMode="decimal"
                defaultValue={shop?.pricePerCan ? fromMinorUnits(shop.pricePerCan) : ""}
                required
              />
            )}
          </Field>
          <Field label="Delivery radius (km)" error={err("deliveryRadiusKm")}>
            {(p) => (
              <Input {...p} name="deliveryRadiusKm" type="number" min={0.5} max={50} step={0.5} defaultValue={shop?.deliveryRadiusKm ?? 5} />
            )}
          </Field>
          <Field label={`Delivery fee (${CURRENCY})`} hint="Use 0 for free delivery." error={err("deliveryFee")}>
            {(p) => (
              <Input
                {...p}
                name="deliveryFee"
                type="number"
                min={0}
                step="any"
                defaultValue={shop ? fromMinorUnits(shop.deliveryFee) : 0}
              />
            )}
          </Field>
          <Field label="Opens at" error={err("hours.opensAt")}>
            {(p) => <Input {...p} name="opensAt" type="time" defaultValue={shop?.hours.opensAt ?? "08:00"} />}
          </Field>
          <Field label="Closes at" error={err("hours.closesAt")}>
            {(p) => <Input {...p} name="closesAt" type="time" defaultValue={shop?.hours.closesAt ?? "22:00"} />}
          </Field>
        </div>
      </Card>

      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
        {saved && (
          <p role="status" className="text-sm text-success">
            Saved.
          </p>
        )}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : shop ? (shop.status === "rejected" ? "Save and resubmit" : "Save changes") : "Register shop"}
        </Button>
      </div>
    </form>
  );
}
