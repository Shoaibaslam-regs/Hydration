"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { DeviceLocationError, getDeviceLocation } from "@/components/map/device-location";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { MapPinIcon } from "@/components/ui/icons";
import { CURRENCY, DEFAULT_RADIUS_KM, MAX_RADIUS_KM } from "@/lib/catalog";
import { cn } from "@/lib/utils";

const RADII = [2, 5, 10, 25, MAX_RADIUS_KM];

/**
 * Search/filter form. State lives in the URL so results are server-rendered
 * and shareable. The main box takes any part of an address or a shop name
 * ("orangi town gulshan e bahar"); the server finds the area and lists the
 * shops around it. "Use my location" replaces the typed area with GPS.
 */
export function ShopFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  // On small screens the extra filters fold away so results start on the first screen.
  const [showFilters, setShowFilters] = useState(false);
  const activeFilters = ["maxPrice", "minRating", "sort", "radiusKm", "deals"].filter((k) => params.get(k)).length;

  const hasLocation = params.has("lat") && params.has("lng");
  const query = params.get("q") ?? "";
  const located = hasLocation || query !== "";

  function navigate(next: URLSearchParams) {
    next.delete("page"); // filters changed → back to page 1
    for (const [key, value] of [...next.entries()]) if (value === "") next.delete(key);
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = new URLSearchParams();
    for (const [key, value] of new FormData(e.currentTarget)) next.set(key, String(value));
    // A typed area replaces the device location; with no text, keep searching around it.
    if (!next.get("q")?.trim() && hasLocation) {
      next.set("lat", params.get("lat")!);
      next.set("lng", params.get("lng")!);
    }
    navigate(next);
  }

  async function locateMe() {
    setLocating(true);
    setGeoError(null);
    try {
      const fix = await getDeviceLocation("Type your area in the search box instead.");
      const next = new URLSearchParams(params);
      next.set("lat", fix.lat.toFixed(5));
      next.set("lng", fix.lng.toFixed(5));
      for (const key of ["q", "near"]) next.delete(key);
      navigate(next);
    } catch (err) {
      setGeoError(err instanceof DeviceLocationError ? err.message : "Couldn't get your location.");
    } finally {
      setLocating(false);
    }
  }

  function clearLocation() {
    const next = new URLSearchParams(params);
    for (const key of ["lat", "lng", "radiusKm", "near", "q"]) next.delete(key);
    if (next.get("sort") === "distance") next.delete("sort");
    navigate(next);
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:p-5">
      {/* Keyed on the URL so fields reset to match it after back/forward navigation. */}
      <form key={params.toString()} onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="q">Where should we deliver?</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="q"
              name="q"
              type="search"
              placeholder="Your area, street or a shop name, e.g. Gulshan-e-Bahar"
              defaultValue={query}
              maxLength={100}
              enterKeyHint="search"
              className="sm:flex-1"
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={pending} className="flex-1 sm:flex-none">
                {pending ? "Searching…" : "Search"}
              </Button>
              <Button variant="secondary" onClick={locateMe} disabled={locating} className="flex-1 whitespace-nowrap sm:flex-none">
                <MapPinIcon />
                {locating ? "Locating…" : "Use my location"}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {hasLocation && !query ? (
              <>
                Showing shops near your location.{" "}
                <button type="button" onClick={clearLocation} className="font-medium text-primary hover:underline">
                  Clear
                </button>
              </>
            ) : (
              "Part of your address is enough; we'll show the shops around it, nearest first."
            )}
          </p>
          {geoError && (
            <p className="text-sm text-danger" role="alert">
              {geoError}
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div id="more-filters" className={cn(showFilters ? "grid gap-3 sm:col-span-2 sm:grid-cols-2" : "hidden", "md:contents")}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="maxPrice">Max price per can ({CURRENCY})</Label>
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
                <option value="">{located ? "Nearest" : "Top rated"}</option>
                {located && <option value="rating">Top rated</option>}
                <option value="price">Lowest price</option>
              </Select>
            </div>
            {located && (
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
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" name="deals" value="1" defaultChecked={params.get("deals") === "1"} className="size-4 accent-[var(--primary)]" />
              Deals only
            </label>
          </div>
          <Button
            variant="secondary"
            className="md:hidden"
            aria-expanded={showFilters}
            aria-controls="more-filters"
            onClick={() => setShowFilters((v) => !v)}
          >
            Filters{activeFilters > 0 && ` (${activeFilters})`}
          </Button>
        </div>
      </form>
    </div>
  );
}
