import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { Product, Shop } from "@/lib/db/models";

/**
 * Recompute the shop's denormalized `productTypes` and `minPrice` from its
 * active products. Call after any product create/update/delete.
 */
export async function refreshShopCatalogSummary(shopId: Types.ObjectId | string): Promise<void> {
  await connectDB();
  const id = new Types.ObjectId(shopId);
  const [summary] = await Product.aggregate<{ types: string[]; minPrice: number }>([
    { $match: { shopId: id, isActive: true } },
    { $group: { _id: null, types: { $addToSet: "$type" }, minPrice: { $min: "$price" } } },
  ]);
  await Shop.updateOne(
    { _id: id },
    { $set: { productTypes: summary?.types.sort() ?? [], minPrice: summary?.minPrice ?? null } },
  );
}
