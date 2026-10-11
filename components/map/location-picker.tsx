"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MapPinIcon } from "@/components/ui/icons";
import type { LatLng } from "@/lib/geo";
import { DeviceLocationError, getDeviceLocation } from "./device-location";
import { LocationMap } from "./location-map";
import { PlaceSearch, type PlaceHit } from "./place-search";

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
  const [picked, setPicked] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function choose(hit: PlaceHit) {
    onChange({ lat: round(hit.lat), lng: round(hit.lng) });
    setPicked([hit.title, hit.subtitle].filter(Boolean).join(", "));
    setMessage("Now drag the pin to the exact spot if needed.");
  }

  async function locate() {
    setMessage(null);
    setLocating(true);
    try {
      const fix = await getDeviceLocation("Search for your area above instead, or tap the map.");
      setPicked(null);
      onChange({ lat: round(fix.lat), lng: round(fix.lng) });
      setMessage(
        fix.accuracy > 200
          ? `Located to within about ${Math.round(fix.accuracy)} m. Drag the pin to the exact spot.`
          : "Located. Drag the pin if it's not exactly right.",
      );
    } catch (err) {
      setMessage(err instanceof DeviceLocationError ? err.message : "Couldn't get your location.");
    } finally {
      setLocating(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{hint}</p>

      <PlaceSearch
        onPick={choose}
        extraButton={
          <Button variant="secondary" onClick={locate} disabled={locating} className="flex-1 whitespace-nowrap sm:flex-none">
            <MapPinIcon />
            {locating ? "Locating…" : "My location"}
          </Button>
        }
      />

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
