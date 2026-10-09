"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, type LatLng } from "@/lib/geo";
import { cn } from "@/lib/utils";

// Map provider: OpenStreetMap tiles via Leaflet (no API key). To switch
// provider, change TILE_URL/ATTRIBUTION or replace this component; callers
// only depend on the props below.
const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const PIN_ZOOM = 16;

/**
 * Interactive map with one pin. With `onChange`, clicking the map or dragging
 * the pin picks a location; without it, the map is read-only.
 */
export function LocationMap({
  value,
  onChange,
  className,
  label = "Map",
}: {
  value: LatLng | null;
  onChange?: (next: LatLng) => void;
  className?: string;
  label?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const onChangeRef = useRef(onChange);
  const initialValue = useRef(value);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Create the map once. Leaflet needs `window`, so it's imported here, never during SSR.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;
      leafletRef.current = L;
      const start = initialValue.current;
      const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView(
        start ?? DEFAULT_MAP_CENTER,
        start ? PIN_ZOOM : DEFAULT_MAP_ZOOM,
      );
      L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
      mapRef.current = map;
      if (start) placeMarker(L, map, markerRef, onChangeRef, start);
      map.on("click", (e) => {
        if (!onChangeRef.current) return;
        const next = { lat: round(e.latlng.lat), lng: round(e.latlng.lng) };
        placeMarker(L, map, markerRef, onChangeRef, next);
        onChangeRef.current(next);
      });
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Keep the pin in sync when the value changes from outside (e.g. "Use my location").
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !value) return;
    const current = markerRef.current?.getLatLng();
    if (current && current.lat === value.lat && current.lng === value.lng) return;
    placeMarker(L, map, markerRef, onChangeRef, value);
    map.setView(value, Math.max(map.getZoom(), PIN_ZOOM));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={label}
      className={cn("z-0 h-64 w-full overflow-hidden rounded-lg border border-border bg-muted", className)}
    />
  );
}

/** Add the pin, or move it if it already exists. Draggable only when the map is editable. */
function placeMarker(
  L: typeof import("leaflet"),
  map: LeafletMap,
  markerRef: React.RefObject<Marker | null>,
  onChangeRef: React.RefObject<((next: LatLng) => void) | undefined>,
  pos: LatLng,
) {
  if (markerRef.current) {
    markerRef.current.setLatLng(pos);
    return;
  }
  const icon = L.divIcon({
    className: "",
    html: '<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#0369a1;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);transform:rotate(-45deg)"></div>',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });
  const marker = L.marker(pos, { icon, draggable: Boolean(onChangeRef.current), keyboard: false }).addTo(map);
  marker.on("dragend", () => {
    const p = marker.getLatLng();
    onChangeRef.current?.({ lat: round(p.lat), lng: round(p.lng) });
  });
  markerRef.current = marker;
}

function round(n: number) {
  return Math.round(n * 1e6) / 1e6;
}
