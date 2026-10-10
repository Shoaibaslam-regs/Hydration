import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { Review, Shop } from "@/lib/db/models";
import { paginated, type Paginated } from "@/lib/validation/pagination";
import type { ShopSearch } from "@/lib/validation/shops";
import { runningDealsForShop } from "./ads/deals";
import { MAX_RADIUS_KM } from "@/lib/catalog";
import { resolveSearchPlace, type SearchPlace } from "./search-place";
import { buildShopSearchPipeline, hasLocation } from "./shop-search";

// DTOs: plain, serializable shapes safe to send to the browser.

export type ShopSummary = {
  id: string;
  slug: string;
  name: string;
  area: string;
  city: string;
  rating: { average: number; count: number };
  /** Price of one 19L can, minor units. Always set for listed shops. */
  pricePerCan: number | null;
  deliveryFee: number;
  hours: { opensAt: string; closesAt: string };
  imageUrl: string | null;
  distanceKm: number | null;
  /** True while the shop is temporarily closed (search never returns closed shops). */
  isClosed: boolean;
  /** Admin-granted "Verified" trust badge. */
  hasVerifiedBadge: boolean;
  /** The shop's running deal that ends last, if any. */
  deal: { title: string; endsAt: string } | null;
};

export type ShopDetail = Omit<ShopSummary, "distanceKm"> & {
  description: string;
  phone: string;
  addressLine1: string;
  deliveryRadiusKm: number;
  location: { lat: number; lng: number };
  reviews: { id: string; authorName: string; rating: number; comment: string; createdAt: string }[];
  /** Why the shop is closed, if it is (shown on the public page). */
  closure: { by: "shopkeeper" | "admin"; reason: string } | null;
  /** End of the shop's trial or paid plan; the shop takes orders only before this. */
  planEndsAt: string | null;
  deals: { id: string; title: string; description: string; endsAt: string }[];
};

/** Cache tag for a shop's public page; revalidate it when the shop, its reviews or deals change. */
export const shopTag = (slug: string) => `shop:${slug}`;

export type ShopRow = {
  _id: Types.ObjectId;
  slug: string;
  name: string;
  address: { area?: string | null; city: string };
  rating?: { average: number; count: number } | null;
  pricePerCan?: number | null;
  deliveryFee?: number | null;
  hours?: { opensAt?: string | null; closesAt?: string | null } | null;
  imageUrl?: string | null;
  distanceMeters?: number;
  closure?: { by: string; reason?: string | null } | null;
  verifiedBadge?: { grantedAt: Date } | null;
  featuredDeal?: { title: string; endsAt: Date } | null;
};

export function toShopSummary(row: ShopRow): ShopSummary {
  return {
    id: row._id.toString(),
    slug: row.slug,
    name: row.name,
    area: row.address.area ?? "",
    city: row.address.city,
    rating: { average: row.rating?.average ?? 0, count: row.rating?.count ?? 0 },
    pricePerCan: row.pricePerCan ?? null,
    deliveryFee: row.deliveryFee ?? 0,
    // Older shop documents may lack these; fall back to the schema defaults.
    hours: { opensAt: row.hours?.opensAt ?? "08:00", closesAt: row.hours?.closesAt ?? "22:00" },
    imageUrl: row.imageUrl ?? null,
    distanceKm: row.distanceMeters === undefined ? null : row.distanceMeters / 1000,
    isClosed: Boolean(row.closure),
    hasVerifiedBadge: Boolean(row.verifiedBadge),
    deal:
      row.featuredDeal && row.featuredDeal.endsAt > new Date()
        ? { title: row.featuredDeal.title, endsAt: row.featuredDeal.endsAt.toISOString() }
        : null,
  };
}

export type ShopSearchResult = Paginated<ShopSummary> & {
  /** Where a typed area/address search was resolved to; results are sorted by distance from it. */
  place: SearchPlace | null;
  /** The search text didn't match any shop address or map place. */
  placeNotFound: boolean;
  /** Nothing was within the chosen distance, so the search widened to this radius (km). */
  widenedToKm: number | null;
  /** The search that actually ran (with the resolved location), e.g. for sponsored slots. */
  searched: ShopSearch;
};

/**
 * Public shop discovery. Not cached: results depend on the visitor's location and filters.
 *
 * Typed text without a location is treated as "where": it's resolved to a
 * point (see resolveSearchPlace) and every listed shop around it is shown,
 * nearest first, so a partial address still finds nearby shops. With a
 * location, text filters by shop name/area instead. If nothing is within the
 * chosen distance, the search widens to MAX_RADIUS_KM once.
 */
export async function searchShops(input: ShopSearch): Promise<ShopSearchResult> {
  await connectDB();
  let searched = input;
  let place: SearchPlace | null = null;
  if (input.q && !hasLocation(input)) {
    place = await resolveSearchPlace(input.q);
    if (!place) return { ...paginated([], 0, input), place: null, placeNotFound: true, widenedToKm: null, searched: input };
    searched = { ...input, q: undefined, lat: place.lat, lng: place.lng };
  }

  let result = await runSearch(searched);
  let widenedToKm: number | null = null;
  if (result.total === 0 && hasLocation(searched) && searched.radiusKm < MAX_RADIUS_KM) {
    searched = { ...searched, radiusKm: MAX_RADIUS_KM };
    result = await runSearch(searched);
    widenedToKm = MAX_RADIUS_KM;
  }
  return { ...result, place, placeNotFound: false, widenedToKm, searched };
}

async function runSearch(input: ShopSearch): Promise<Paginated<ShopSummary>> {
  const [result] = await Shop.aggregate<{ items: ShopRow[]; total: { n: number }[] }>(buildShopSearchPipeline(input));
  return paginated(result.items.map(toShopSummary), result.total[0]?.n ?? 0, input);
}

/** A verified shop with its active products, or null. Cached per slug; see `shopTag`. */
export async function getShopBySlug(slug: string): Promise<ShopDetail | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(shopTag(slug));

  await connectDB();
  const shop = await Shop.findOne({ slug, status: "verified" }).lean();
  if (!shop) return null;

  const [reviews, deals] = await Promise.all([
    Review.find({ shopId: shop._id }).sort({ createdAt: -1 }).limit(10).lean(),
    runningDealsForShop(shop._id),
  ]);

  const [lng, lat] = shop.location.coordinates;
  return {
    ...toShopSummary(shop as unknown as ShopRow),
    description: shop.description ?? "",
    phone: shop.phone,
    addressLine1: shop.address.line1,
    closure: shop.closure ? { by: shop.closure.by as "shopkeeper" | "admin", reason: shop.closure.reason ?? "" } : null,
    planEndsAt: shop.subscription?.endsAt ? shop.subscription.endsAt.toISOString() : null,
    deals,
    deliveryRadiusKm: shop.deliveryRadiusKm ?? 0,
    location: { lat, lng },
    reviews: reviews.map((r) => ({
      id: r._id.toString(),
      authorName: r.authorName,
      rating: r.rating,
      comment: r.comment ?? "",
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
