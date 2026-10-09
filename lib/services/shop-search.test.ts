import { describe, expect, it } from "vitest";
import { shopSearchSchema } from "@/lib/validation/shops";
import { buildShopSearchPipeline } from "./shop-search";

const build = (query: Record<string, string>) => buildShopSearchPipeline(shopSearchSchema.parse(query));

describe("buildShopSearchPipeline", () => {
  it("starts with $geoNear when a location is given", () => {
    const [first] = build({ lat: "31.5", lng: "74.3", radiusKm: "5" });
    expect(first).toMatchObject({
      $geoNear: {
        near: { type: "Point", coordinates: [74.3, 31.5] },
        maxDistance: 5000,
        query: { status: "verified", closure: null },
      },
    });
  });

  it("uses $match and rating sort without a location", () => {
    const pipeline = build({});
    expect(pipeline[0]).toHaveProperty("$match.status", "verified");
    expect(pipeline[1]).toEqual({ $sort: { "rating.average": -1, "rating.count": -1, _id: 1 } });
  });

  it("sorts by distance by default when located", () => {
    expect(build({ lat: "1", lng: "1" })[1]).toEqual({ $sort: { distanceMeters: 1, _id: 1 } });
  });

  it("applies filters, converting max price to minor units", () => {
    const [stage] = build({ type: "refill", maxPrice: "150", minRating: "4" });
    expect(stage).toMatchObject({
      $match: { productTypes: "refill", minPrice: { $lte: 15000 }, "rating.average": { $gte: 4 } },
    });
  });

  it("escapes regex characters in the text query", () => {
    const [stage] = build({ q: "a.b*" }) as [{ $match: { $or: { name: RegExp }[] } }];
    expect(stage.$match.$or[0].name.source).toBe("a\\.b\\*");
  });

  it("paginates inside $facet", () => {
    const facet = build({ page: "3", limit: "10" }).at(-1) as { $facet: { items: object[] } };
    expect(facet.$facet.items.slice(0, 2)).toEqual([{ $skip: 20 }, { $limit: 10 }]);
  });
});
