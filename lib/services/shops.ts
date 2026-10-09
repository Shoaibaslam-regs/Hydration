import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { Types } from "mongoose";
import type { ProductType } from "@/lib/catalog";
import { connectDB } from "@/lib/db/connect";
import { Product, Review, Shop } from "@/lib/db/models";
import { paginated, type Paginated } from "@/lib/validation/pagination";
import type { ShopSearch } from "@/lib/validation/shops";
import { buildShopSearchPipeline } from "./shop-search";

// DTOs: plain, serializable shapes safe to send to the browser.

export type ShopSummary = {
  id: string;
  slug: string;
  name: string;
  area: string;
  city: string;
  rating: { average: number; count: number };
  productTypes: ProductType[];
  minPrice: number | null;
  deliveryFee: number;
  hours: { opensAt: string; closesAt: string };
  imageUrl: string | null;
  distanceKm: number | null;
  /** True while the shop is temporarily closed (search never returns closed shops). */
  isClosed: boolean;
};

export type ProductSummary = {
  id: string;
  name: string;
  type: ProductType;
  description: string;
  sizeLiters: number | null;
  price: number;
  inStock: boolean;
  imageUrl: string | null;
};

export type ShopDetail = Omit<ShopSummary, "distanceKm"> & {
  description: string;
  phone: string;
  addressLine1: string;
  deliveryRadiusKm: number;
  location: { lat: number; lng: number };
  products: ProductSummary[];
  reviews: { id: string; authorName: string; rating: number; comment: string; createdAt: string }[];
  /** Why the shop is closed, if it is (shown on the public page). */
  closure: { by: "shopkeeper" | "admin"; reason: string } | null;
};

/** Cache tag for a shop's public page; revalidate it when the shop or its products change. */
export const shopTag = (slug: string) => `shop:${slug}`;

type ShopRow = {
  _id: Types.ObjectId;
  slug: string;
  name: string;
  address: { area?: string | null; city: string };
  rating: { average: number; count: number };
  productTypes: string[];
  minPrice: number | null;
  deliveryFee: number;
  hours: { opensAt: string; closesAt: string };
  imageUrl?: string | null;
  distanceMeters?: number;
  closure?: { by: string; reason?: string | null } | null;
};

function toShopSummary(row: ShopRow): ShopSummary {
  return {
    id: row._id.toString(),
    slug: row.slug,
    name: row.name,
    area: row.address.area ?? "",
    city: row.address.city,
    rating: { average: row.rating.average, count: row.rating.count },
    productTypes: row.productTypes as ProductType[],
    minPrice: row.minPrice ?? null,
    deliveryFee: row.deliveryFee,
    hours: { opensAt: row.hours.opensAt, closesAt: row.hours.closesAt },
    imageUrl: row.imageUrl ?? null,
    distanceKm: row.distanceMeters === undefined ? null : row.distanceMeters / 1000,
    isClosed: Boolean(row.closure),
  };
}

/** Public shop discovery. Not cached: results depend on the visitor's location and filters. */
export async function searchShops(input: ShopSearch): Promise<Paginated<ShopSummary>> {
  await connectDB();
  const [result] = await Shop.aggregate<{ items: ShopRow[]; total: { n: number }[] }>(
    buildShopSearchPipeline(input),
  );
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

  const [products, reviews] = await Promise.all([
    Product.find({ shopId: shop._id, isActive: true }).sort({ type: 1, price: 1 }).lean(),
    Review.find({ shopId: shop._id }).sort({ createdAt: -1 }).limit(10).lean(),
  ]);

  const [lng, lat] = shop.location.coordinates;
  return {
    ...toShopSummary(shop as unknown as ShopRow),
    description: shop.description ?? "",
    phone: shop.phone,
    addressLine1: shop.address.line1,
    closure: shop.closure ? { by: shop.closure.by as "shopkeeper" | "admin", reason: shop.closure.reason ?? "" } : null,
    deliveryRadiusKm: shop.deliveryRadiusKm ?? 0,
    location: { lat, lng },
    products: products.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      type: p.type as ProductType,
      description: p.description ?? "",
      sizeLiters: p.sizeLiters ?? null,
      price: p.price,
      inStock: (p.stock ?? 0) > 0,
      imageUrl: p.imageUrl ?? null,
    })),
    reviews: reviews.map((r) => ({
      id: r._id.toString(),
      authorName: r.authorName,
      rating: r.rating,
      comment: r.comment ?? "",
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
