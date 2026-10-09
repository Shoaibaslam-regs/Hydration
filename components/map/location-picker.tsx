"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api/client";
import type { LatLng } from "@/lib/geo";
import { LocationMap } from "./location-map";

type SearchHit = { title: string; subtitle: string; lat: number; lng: number };

const round = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Pick a location three ways: search an address/area, use the device's
 * location, or tap/drag the pin. Search works everywhere; device location
 * needs HTTPS (browsers block it on plain-HTTP pages such as a phone opening
 * http://192.168.x.x during development).
 */
export function LocationPicker({
  value,
  onChange,
  error,
  hint = "Search your area or street, or use your location, then drag the pin to the exact spot.",
}: {
  value: LatLng | null;
  onChange: (next: LatLng) => void;
  error?: string;
  hint?: string;
}) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function search() {
    const q = query.trim();
    if (q.length < 3) {
      setMessage("Type at least 3 characters, e.g. a street, area or landmark.");
      return;
    }
    setSearching(true);
    setMessage(null);
    const result = await apiRequest<{ items: SearchHit[] }>(`/api/geocode?q=${encodeURIComponent(q)}`);
    setSearching(false);
    if (!result.ok) {
      setHits(null);
      setMessage(result.fieldErrors.q?.[0] ?? result.message);
      return;
    }
    setHits(result.data.items);
    if (result.data.items.length === 0) setMessage("No places found. Try a nearby landmark or area name, or tap the map.");
  }

  function choose(hit: SearchHit) {
    onChange({ lat: round(hit.lat), lng: round(hit.lng) });
    setPicked([hit.title, hit.subtitle].filter(Boolean).join(", "));
    setHits(null);
    setMessage("Now drag the pin to the exact spot if needed.");
  }

  function locate() {
    setMessage(null);
    if (!window.isSecureContext) {
      setMessage(
        "Your browser only shares location on secure (https://) pages. Search for your area above instead, or tap the map.",
      );
      return;
    }
    if (!("geolocation" in navigator)) {
      setMessage("This browser can't share your location. Search for your area above instead.");
      return;
    }
    setLocating(true);
    const success = ({ coords }: GeolocationPosition) => {
      setLocating(false);
      setPicked(null);
      onChange({ lat: round(coords.latitude), lng: round(coords.longitude) });
      setMessage(
        coords.accuracy > 200
          ? `Located to within about ${Math.round(coords.accuracy)} m. Drag the pin to the exact spot.`
          : "Located. Drag the pin if it's not exactly right.",
      );
    };
    const fail = (err: GeolocationPositionError) => {
      setLocating(false);
      setMessage(
        err.code === err.PERMISSION_DENIED
          ? "Location access is blocked. Allow it in your browser's site settings, or search for your area above."
          : "Couldn't get your location. Make sure location (GPS) is on, or search for your area above.",
      );
    };
    // GPS can be slow indoors: if the precise fix times out, retry with network-based location.
    navigator.geolocation.getCurrentPosition(
      success,
      (err) => {
        if (err.code === err.TIMEOUT || err.code === err.POSITION_UNAVAILABLE) {
          navigator.geolocation.getCurrentPosition(success, fail, { enableHighAccuracy: false, timeout: 15_000, maximumAge: 60_000 });
        } else fail(err);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{hint}</p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // Search instead of submitting the surrounding form.
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
          placeholder="Search area, street or landmark"
          aria-label="Search for a place on the map"
          maxLength={200}
        />
        <div className="flex gap-2">
          <Button variant="secondary" onClick={search} disabled={searching} className="flex-1 sm:flex-none">
            {searching ? "Searching…" : "Search"}
          </Button>
          <Button variant="secondary" onClick={locate} disabled={locating} className="flex-1 whitespace-nowrap sm:flex-none">
            {locating ? "Locating…" : "📍 My location"}
          </Button>
        </div>
      </div>

      {hits && hits.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card" aria-label="Search results">
          {hits.map((h) => (
            <li key={`${h.lat},${h.lng}`}>
              <button type="button" onClick={() => choose(h)} className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">
                <span className="font-medium">{h.title}</span>
                {h.subtitle && <span className="truncate text-xs text-muted-foreground">{h.subtitle}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {message && (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      )}

      <LocationMap value={value} onChange={onChange} label="Pick location on map" />
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {value
          ? `${picked ? `Near ${picked} · ` : ""}Pin at ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`
          : "No location set yet."}
      </p>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
