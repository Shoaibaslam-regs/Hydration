import "server-only";
import { Types } from "mongoose";
import { ApiError } from "@/lib/api/errors";
import type { ProductType } from "@/lib/catalog";
import { connectDB } from "@/lib/db/connect";
import { Shop, User } from "@/lib/db/models";
import type { ShopSummary } from "./shops";

export async function addFavorite(userId: string, shopId: string): Promise<void> {
  await connectDB();
  if (!(await Shop.exists({ _id: shopId, status: "verified" }))) throw ApiError.notFound("Shop not found");
  await User.updateOne({ _id: userId }, { $addToSet: { favoriteShopIds: new Types.ObjectId(shopId) } });
}

export async function removeFavorite(userId: string, shopId: string): Promise<void> {
  await connectDB();
  await User.updateOne({ _id: userId }, { $pull: { favoriteShopIds: new Types.ObjectId(shopId) } });
}

export async function isFavorite(userId: string, shopId: string): Promise<boolean> {
  await connectDB();
  return Boolean(await User.exists({ _id: userId, favoriteShopIds: new Types.ObjectId(shopId) }));
}

/** Favorite shops that are still public (verified), most recently added first. */
export async function listFavoriteShops(userId: string): Promise<ShopSummary[]> {
  await connectDB();
  const user = await User.findById(userId, { favoriteShopIds: 1 }).lean();
  const ids = (user?.favoriteShopIds ?? []).slice().reverse();
  if (ids.length === 0) return [];
  const shops = await Shop.find({ _id: { $in: ids }, status: "verified" }).lean();
  const byId = new Map(shops.map((s) => [s._id.toString(), s]));
  return ids
    .map((id) => byId.get(id.toString()))
    .filter((s) => s !== undefined)
    .map((s) => ({
      id: s._id.toString(),
      slug: s.slug,
      name: s.name,
      area: s.address.area ?? "",
      city: s.address.city,
      rating: { average: s.rating?.average ?? 0, count: s.rating?.count ?? 0 },
      productTypes: (s.productTypes ?? []) as ProductType[],
      minPrice: s.minPrice ?? null,
      deliveryFee: s.deliveryFee ?? 0,
      hours: { opensAt: s.hours?.opensAt ?? "", closesAt: s.hours?.closesAt ?? "" },
      imageUrl: s.imageUrl ?? null,
      distanceKm: null,
      isClosed: Boolean(s.closure),
    }));
}
