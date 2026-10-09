"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { CURRENCY, DEFAULT_RADIUS_KM, MAX_RADIUS_KM, PRODUCT_TYPE_LABELS, PRODUCT_TYPES } from "@/lib/catalog";
import { cn } from "@/lib/utils";

const RADII = [2, 5, 10, 25, MAX_RADIUS_KM];

/** Search/filter form. State lives in the URL so results are server-rendered and shareable. */
export function ShopFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  // On small screens the extra filters fold away so results start on the first screen.
  const [showFilters, setShowFilters] = useState(false);
  const activeFilters = ["type", "maxPrice", "minRating", "sort", "radiusKm"].filter((k) => params.get(k)).length;

  const hasLocation = params.has("lat") && params.has("lng");

  function navigate(next: URLSearchParams) {
    next.delete("page"); // filters changed → back to page 1
    for (const [key, value] of [...next.entries()]) if (value === "") next.delete(key);
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = new URLSearchParams();
    for (const [key, value] of new FormData(e.currentTarget)) next.set(key, String(value));
    if (hasLocation) {
      next.set("lat", params.get("lat")!);
      next.set("lng", params.get("lng")!);
    }
    navigate(next);
  }

  function locateMe() {
    if (!("geolocation" in navigator)) {
      setGeoError("Your browser doesn't support location.");
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        const next = new URLSearchParams(params);
        next.set("lat", coords.latitude.toFixed(5));
        next.set("lng", coords.longitude.toFixed(5));
        navigate(next);
      },
      (err) => {
        setLocating(false);
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. You can still search by name or area."
            : "Couldn't get your location. Please try again.",
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  function clearLocation() {
    const next = new URLSearchParams(params);
    for (const key of ["lat", "lng", "radiusKm"]) next.delete(key);
    if (next.get("sort") === "distance") next.delete("sort");
    navigate(next);
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {hasLocation ? "Showing shops near your location." : "Share your location to see shops near you."}
        </p>
        <div className="flex gap-2">
          <Button variant={hasLocation ? "secondary" : "primary"} size="sm" onClick={locateMe} disabled={locating}>
            {locating ? "Locating…" : hasLocation ? "Update location" : "📍 Use my location"}
          </Button>
          {hasLocation && (
            <Button variant="ghost" size="sm" onClick={clearLocation}>
              Clear
            </Button>
          )}
        </div>
      </div>
      {geoError && <p className="text-sm text-danger">{geoError}</p>}

      {/* Keyed on the URL so fields reset to match it after back/forward navigation. */}
      <form key={params.toString()} onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="q">Search</Label>
          <Input id="q" name="q" type="search" placeholder="Shop name or area" defaultValue={params.get("q") ?? ""} maxLength={100} />
        </div>
        <div id="more-filters" className={cn(showFilters ? "grid gap-3 sm:col-span-2 sm:grid-cols-2" : "hidden", "md:contents")}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="type">Product</Label>
          <Select id="type" name="type" defaultValue={params.get("type") ?? ""}>
            <option value="">Any</option>
            {PRODUCT_TYPES.map((t) => (
              <option key={t} value={t}>
                {PRODUCT_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="maxPrice">Max price ({CURRENCY})</Label>
          <Input id="maxPrice" name="maxPrice" type="number" min={1} inputMode="numeric" defaultValue={params.get("maxPrice") ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="minRating">Rating</Label>
          <Select id="minRating" name="minRating" defaultValue={params.get("minRating") ?? ""}>
            <option value="">Any</option>
            <option value="4">4★ & up</option>
            <option value="3">3★ & up</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sort">Sort by</Label>
          <Select id="sort" name="sort" defaultValue={params.get("sort") ?? ""}>
            <option value="">{hasLocation ? "Nearest" : "Top rated"}</option>
            {hasLocation && <option value="rating">Top rated</option>}
            <option value="price">Lowest price</option>
          </Select>
        </div>
        {hasLocation && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="radiusKm">Distance</Label>
            <Select id="radiusKm" name="radiusKm" defaultValue={params.get("radiusKm") ?? String(DEFAULT_RADIUS_KM)}>
              {RADII.map((r) => (
                <option key={r} value={r}>
                  Within {r} km
                </option>
              ))}
            </Select>
          </div>
        )}
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
          <Button
            variant="secondary"
            className="md:hidden"
            aria-expanded={showFilters}
            aria-controls="more-filters"
            onClick={() => setShowFilters((v) => !v)}
          >
            Filters{activeFilters > 0 && ` (${activeFilters})`}
          </Button>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Searching…" : "Search"}
          </Button>
        </div>
      </form>
    </div>
  );
}
