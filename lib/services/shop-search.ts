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

/**
 * Builds the aggregation for public shop search. Only verified, open shops
 * with at least one active product are listed. With coordinates it uses $geoNear
 * (requires the 2dsphere index on `location`), which must be the first stage.
 * Results are paginated server-side via $facet.
 */
export function buildShopSearchPipeline(
  input: ShopSearch,
  options: { requirePlanActiveAt?: Date } = {},
): PipelineStage[] {
  // `closure: null` also matches shops saved before the field existed.
  const match: Record<string, unknown> = { status: "verified", closure: null, "productTypes.0": { $exists: true } };
  // Only while the "require an active plan" setting is on.
  if (options.requirePlanActiveAt) match["subscription.endsAt"] = { $gt: options.requirePlanActiveAt };

  if (input.q) {
    const rx = new RegExp(escapeRegex(input.q), "i");
    match.$or = [{ name: rx }, { "address.area": rx }, { "address.city": rx }];
  }
  if (input.type) match.productTypes = input.type;
  if (input.maxPrice !== undefined) match.minPrice = { $lte: toMinorUnits(input.maxPrice) };
  if (input.minRating !== undefined) match["rating.average"] = { $gte: input.minRating };

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
      ? { minPrice: 1, "rating.average": -1, _id: 1 }
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
          {
            $project: {
              slug: 1,
              name: 1,
              "address.area": 1,
              "address.city": 1,
              rating: 1,
              productTypes: 1,
              minPrice: 1,
              deliveryFee: 1,
              hours: 1,
              imageUrl: 1,
              distanceMeters: 1,
              verifiedBadge: 1,
            },
          },
        ],
        total: [{ $count: "n" }],
      },
    },
  );

  return pipeline;
}
