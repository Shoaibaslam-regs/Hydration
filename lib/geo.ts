export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371.0088;

/** Great-circle distance in km (haversine). Matches MongoDB's spherical $geoNear closely enough for radius checks. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Where the map opens when there's no location yet. */
export const DEFAULT_MAP_CENTER: LatLng = { lat: 30.3753, lng: 69.3451 };
export const DEFAULT_MAP_ZOOM = 5;
