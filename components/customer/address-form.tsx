"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/auth/form-error";
import { LocationPicker } from "@/components/map/location-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api/client";
import { safeNextPath } from "@/lib/auth/roles";
import type { LatLng } from "@/lib/geo";
import type { SavedAddress } from "@/lib/services/addresses";

export function AddressForm({ address, next }: { address: SavedAddress | null; next?: string | null }) {
  const router = useRouter();
  const [location, setLocation] = useState<LatLng | null>(address?.location ?? null);
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const err = (k: string) => fieldErrors[k]?.[0];
  const done = () => {
    router.push(safeNextPath(next) ?? "/account/addresses");
    router.refresh();
  };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!location) {
      setFieldErrors({ location: ["Pin the address on the map"] });
      setError("Please fix the highlighted fields.");
      return;
    }
    setPending(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    const str = (k: string) => String(f.get(k) ?? "");
    const result = await apiRequest(address ? `/api/customer/addresses/${address.id}` : "/api/customer/addresses", {
      method: address ? "PUT" : "POST",
      body: {
        label: str("label"),
        line1: str("line1"),
        area: str("area"),
        city: str("city"),
        notes: str("notes"),
        location,
        isDefault: f.get("isDefault") === "on",
      },
    });
    if (!result.ok) {
      setPending(false);
      setError(result.message);
      setFieldErrors(result.fieldErrors);
      return;
    }
    done();
  }

  async function onDelete() {
    if (!address || !confirm(`Delete the address "${address.label}"?`)) return;
    setDeleting(true);
    const result = await apiRequest(`/api/customer/addresses/${address.id}`, { method: "DELETE" });
    if (!result.ok) {
      setDeleting(false);
      setError(result.message);
      return;
    }
    done();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <FormError message={error} />
      <Card className="flex flex-col gap-4">
        <Field label="Name for this address" hint="e.g. Home, Office" error={err("label")}>
          {(p) => <Input {...p} name="label" defaultValue={address?.label ?? "Home"} maxLength={40} required />}
        </Field>
        <Field label="Street address" hint="House number, street, building" error={err("line1")}>
          {(p) => <Input {...p} name="line1" defaultValue={address?.line1} autoComplete="street-address" required />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Area / neighborhood" error={err("area")}>
            {(p) => <Input {...p} name="area" defaultValue={address?.area} />}
          </Field>
          <Field label="City" error={err("city")}>
            {(p) => <Input {...p} name="city" defaultValue={address?.city} autoComplete="address-level2" required />}
          </Field>
        </div>
        <Field label="Delivery notes (optional)" hint="Gate code, floor, landmark…" error={err("notes")}>
          {(p) => <Input {...p} name="notes" defaultValue={address?.notes} maxLength={300} />}
        </Field>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Location on map</p>
          <LocationPicker
            value={location}
            onChange={setLocation}
            hint="Shops use this to check they can deliver to you. Search your area or use your location, then drag the pin to your door."
            error={err("location") ?? err("location.lat") ?? err("location.lng")}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isDefault" defaultChecked={address?.isDefault ?? false} className="size-4 accent-[var(--primary)]" />
          Use as my default address
        </label>
      </Card>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {address ? (
          <Button variant="danger-ghost" onClick={onDelete} disabled={deleting || pending}>
            {deleting ? "Deleting…" : "Delete address"}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" size="lg" disabled={pending || deleting}>
          {pending ? "Saving…" : address ? "Save address" : "Add address"}
        </Button>
      </div>
    </form>
  );
}
