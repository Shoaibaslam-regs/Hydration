import "server-only";
import type { PipelineStage } from "mongoose";
import { rateLimit } from "@/lib/api/rate-limit";
import { connectDB } from "@/lib/db/connect";
import { Shop } from "@/lib/db/models";
import { searchTokens } from "@/lib/search/text";
import { geocode } from "./geocode";

export type SearchPlace = {
  lat: number;
  lng: number;
  /** What we understood, e.g. "Gulshan-e-Bahar, Orangi Town, Karachi". */
  label: string;
  /** "shops": an approved shop's address matched the words; "map": found by the map search. */
  source: "shops" | "map";
};

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The approved shop whose name/address matches the most query words (any order), with how many matched. */
export async function bestAddressMatch(tokens: string[]): Promise<{ score: number; place: SearchPlace } | null> {
  if (tokens.length === 0) return null;
  await connectDB();
  const regexes = tokens.map((t) => new RegExp(escapeRegex(t), "i"));
  const pipeline: PipelineStage[] = [
    { $match: { status: "verified", $or: regexes.map((rx) => ({ searchText: rx })) } },
    {
      $addFields: {
        score: { $add: regexes.map((rx) => ({ $cond: [{ $regexMatch: { input: "$searchText", regex: rx } }, 1, 0] })) },
      },
    },
    { $sort: { score: -1, "rating.average": -1, _id: 1 } },
    { $limit: 1 },
    { $project: { score: 1, location: 1, address: 1 } },
  ];
  const [best] = await Shop.aggregate<{ score: number; location: { coordinates: number[] }; address: { area?: string; city: string } }>(pipeline);
  if (!best) return null;
  const [lng, lat] = best.location.coordinates;
  return {
    score: best.score,
    place: { lat, lng, label: [best.address.area, best.address.city].filter(Boolean).join(", "), source: "shops" },
  };
}

/**
 * Turn what a customer typed ("orangi town gulshan e bahar") into a point to
 * search around:
 * 1. a shop address containing at least half of the words, in any order;
 * 2. otherwise the map search (server-side Nominatim, cached; a site-wide
 *    limit keeps us inside its usage policy);
 * 3. otherwise the best partial address match, if any.
 * Returns null when nothing matches.
 */
export async function resolveSearchPlace(query: string): Promise<SearchPlace | null> {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return null;

  const match = await bestAddressMatch(tokens);
  if (match && match.score >= Math.ceil(tokens.length / 2)) return match.place;

  const mapHit = await mapSearch(query);
  if (mapHit) return mapHit;
  return match?.place ?? null;
}

async function mapSearch(query: string): Promise<SearchPlace | null> {
  const q = query.trim().toLowerCase().slice(0, 200);
  if (q.length < 3) return null;
  try {
    await rateLimit("geocode:all", 60, 60 * 1000);
    const [hit] = await geocode(q);
    return hit ? { lat: hit.lat, lng: hit.lng, label: [hit.title, hit.subtitle].filter(Boolean).join(", "), source: "map" } : null;
  } catch {
    // Map search unavailable or busy: fall back to shop addresses only.
    return null;
  }
}
