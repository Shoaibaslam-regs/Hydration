import type { PipelineStage } from "mongoose";
import { toMinorUnits } from "@/lib/catalog";
import { skipFor } from "@/lib/validation/pagination";
import type { ShopSearch } from "@/lib/validation/shops";

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function hasLocation(input: ShopSearch): input is ShopSearch & { lat: number; lng: number } {
  return input.lat !== undefined && input.lng !== undefined;
}

export type SearchOptions = {
  /** "Now", for the plan and deal checks. Defaults to the current time. */
  now?: Date;
};

/** The customer's filters as a MongoDB match. Shared by organic results and sponsored slots. */
export function buildSearchMatch(input: ShopSearch, options: SearchOptions = {}): Record<string, unknown> {
  const now = options.now ?? new Date();
  // Same rules as listableShopFilter(). `closure: null` also matches shops saved before the field existed.
  const match: Record<string, unknown> = {
    status: "verified",
    closure: null,
    pricePerCan: { $gt: 0 },
    "subscription.endsAt": { $gt: now },
  };

  if (input.q) {
    const rx = new RegExp(escapeRegex(input.q), "i");
    match.$or = [{ name: rx }, { "address.area": rx }, { "address.city": rx }];
  }
  if (input.maxPrice !== undefined) match.pricePerCan = { $gt: 0, $lte: toMinorUnits(input.maxPrice) };
  if (input.minRating !== undefined) match["rating.average"] = { $gte: input.minRating };
  if (input.deals) match["featuredDeal.endsAt"] = { $gt: now };
  return match;
}

const CARD_FIELDS = {
  slug: 1,
  name: 1,
  "address.area": 1,
  "address.city": 1,
  rating: 1,
  pricePerCan: 1,
  deliveryFee: 1,
  hours: 1,
  imageUrl: 1,
  distanceMeters: 1,
  verifiedBadge: 1,
  starAward: 1,
  featuredDeal: 1,
} as const;

/**
 * Builds the aggregation for public shop search. Only approved, open shops
 * with a can price and a running trial or plan are listed. With coordinates it uses $geoNear
 * (requires the 2dsphere index on `location`), which must be the first stage.
 * Results are paginated server-side via $facet.
 */
export function buildShopSearchPipeline(input: ShopSearch, options: SearchOptions = {}): PipelineStage[] {
  const match = buildSearchMatch(input, options);

  const pipeline: PipelineStage[] = hasLocation(input)
    ? [
        {
          $geoNear: {
            near: { type: "Point", coordinates: [input.lng, input.lat] },
            distanceField: "distanceMeters",
            maxDistance: input.radiusKm * 1000,
            spherical: true,
            query: match,
          },
        },
      ]
    : [{ $match: match }];

  const sort = input.sort ?? (hasLocation(input) ? "distance" : "rating");
  const sortStage: Record<string, 1 | -1> =
    sort === "price"
      ? { pricePerCan: 1, "rating.average": -1, _id: 1 }
      : sort === "distance" && hasLocation(input)
        ? { distanceMeters: 1, _id: 1 }
        : { "rating.average": -1, "rating.count": -1, _id: 1 };

  pipeline.push(
    { $sort: sortStage },
    {
      $facet: {
        items: [
          { $skip: skipFor(input) },
          { $limit: input.limit },
          { $project: CARD_FIELDS },
        ],
        total: [{ $count: "n" }],
      },
    },
  );

  return pipeline;
}

/**
 * Sponsored slots for a located search: up to `slots` random shops among
 * `sponsoredShopIds` (shops with a running approved campaign) that match
 * the customer's filters, are within the search radius AND deliver to the
 * customer (inside their own delivery radius). Random so eligible shops share
 * the slots fairly. Returns no stages to run without a location.
 */
export function buildSponsoredPipeline(
  input: ShopSearch,
  opts: SearchOptions & { sponsoredShopIds: string[] | { toString(): string }[]; slots: number },
): PipelineStage[] | null {
  if (!hasLocation(input) || opts.sponsoredShopIds.length === 0) return null;
  const match = buildSearchMatch(input, opts);
  const eligible = { _id: { $in: opts.sponsoredShopIds } };
  return [
    {
      $geoNear: {
        near: { type: "Point", coordinates: [input.lng, input.lat] },
        distanceField: "distanceMeters",
        maxDistance: input.radiusKm * 1000,
        spherical: true,
        query: { $and: [match, eligible] },
      },
    },
    // Only shops that actually deliver to this customer.
    { $match: { $expr: { $lte: ["$distanceMeters", { $multiply: [{ $ifNull: ["$deliveryRadiusKm", 0] }, 1000] }] } } },
    { $sample: { size: opts.slots } },
    { $project: CARD_FIELDS },
  ];
}
