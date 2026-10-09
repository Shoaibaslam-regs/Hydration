import "server-only";
import { cacheLife } from "next/cache";
import { ApiError } from "@/lib/api/errors";
import { env } from "@/lib/env";

export type GeocodeResult = {
  /** Short name, e.g. "Liberty Market". */
  title: string;
  /** A little context, e.g. "Gulberg, Lahore". */
  subtitle: string;
  lat: number;
  lng: number;
};

type NominatimHit = { display_name: string; lat: string; lon: string };

/**
 * Address/place search for the map picker, via Nominatim (OpenStreetMap).
 * Called from our server (never the browser) so we can send the identifying
 * User-Agent its usage policy requires, rate-limit per user, and cache: the
 * same query is answered from cache for a day. The public instance is for
 * light use; set GEOCODER_URL to a paid/self-hosted geocoder before launch.
 */
export async function geocode(query: string): Promise<GeocodeResult[]> {
  "use cache";
  cacheLife("days");

  const { GEOCODER_URL, GEOCODER_CONTACT_EMAIL } = env();
  const url = new URL("/search", GEOCODER_URL);
  url.search = new URLSearchParams({ q: query, format: "jsonv2", limit: "5", addressdetails: "0" }).toString();

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": `Aqua/1.0 (water delivery app${GEOCODER_CONTACT_EMAIL ? `; ${GEOCODER_CONTACT_EMAIL}` : ""})`,
        "Accept-Language": "en",
      },
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw ApiError.upstream("Map search isn't responding. Try again, or tap the map instead.");
  }
  if (!res.ok) throw ApiError.upstream("Map search isn't available right now. Tap the map instead.");

  const hits = (await res.json()) as NominatimHit[];
  return toResults(hits);
}

/** Shorten Nominatim's long "a, b, c, …, country" labels and drop near-duplicates. */
export function toResults(hits: NominatimHit[]): GeocodeResult[] {
  const seen = new Set<string>();
  const out: GeocodeResult[] = [];
  for (const h of hits) {
    const lat = Number(h.lat);
    const lng = Number(h.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    // Drop postcodes and the administrative tail (tehsil/district/division/country).
    const parts = h.display_name.split(",").map((p) => p.trim()).filter((p) => p && !/^\d{4,}$/.test(p));
    const title = parts[0] ?? h.display_name;
    const subtitle = parts.slice(1, 3).join(", ");
    // Entries that would look identical in the list (e.g. "Liberty Market" as a
    // market, a road and a neighbourhood) collapse into the first one.
    const key = `${title}|${subtitle}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title, subtitle, lat, lng });
  }
  return out;
}
