"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { LatLng } from "@/lib/geo";
import { LocationMap } from "./location-map";

/** Map pin + "use my location" button. Tap the map or drag the pin to adjust. */
export function LocationPicker({
  value,
  onChange,
  error,
  hint = "Tap the map or drag the pin to the exact spot.",
}: {
  value: LatLng | null;
  onChange: (next: LatLng) => void;
  error?: string;
  hint?: string;
}) {
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  function locate() {
    if (!("geolocation" in navigator)) {
      setGeoError("Your browser doesn't support location. Tap the map instead.");
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        onChange({ lat: Math.round(coords.latitude * 1e6) / 1e6, lng: Math.round(coords.longitude * 1e6) / 1e6 });
      },
      () => {
        setLocating(false);
        setGeoError("Couldn't get your location. Allow location access, or tap the map instead.");
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{hint}</p>
        <Button variant="secondary" size="sm" onClick={locate} disabled={locating}>
          {locating ? "Locating…" : "📍 Use my location"}
        </Button>
      </div>
      <LocationMap value={value} onChange={onChange} label="Pick location on map" />
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {value ? `Pin at ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}` : "No location set yet."}
      </p>
      {(error || geoError) && <p className="text-sm text-danger">{error ?? geoError}</p>}
    </div>
  );
}
