import "server-only";
import { revalidateTag } from "next/cache";
import type { Types } from "mongoose";
import { Order, Review, Shop, StarCustomer, User } from "@/lib/db/models";
import { FINAL_ORDER_STATUSES, ORDER_STATUSES } from "@/lib/orders/status";
import { shopTag } from "./shops";

/**
 * Permanently delete a shop and its data. Order matters: close the shop first
 * (so no new orders slip in), cancel its unfinished orders, delete reviews
 * and favorites, then the shop. Past orders stay, because each order holds
 * its own copy of what was bought. Used by admins and by owners.
 */
export async function removeShopData(
  shop: { _id: Types.ObjectId; slug: string },
  by: "admin" | "shopkeeper",
  orderNote: string,
): Promise<{ cancelledOrders: number }> {
  await Shop.updateOne({ _id: shop._id }, { $set: { closure: { by, at: new Date(), reason: orderNote.slice(0, 300) } } });
  const unfinished = ORDER_STATUSES.filter((s) => !FINAL_ORDER_STATUSES.includes(s));
  const cancelled = await Order.updateMany(
    { shopId: shop._id, status: { $in: unfinished } },
    {
      $set: { status: "cancelled" },
      $push: { statusHistory: { status: "cancelled", at: new Date(), by, note: orderNote.slice(0, 300) } },
    },
  );
  await Promise.all([
    Review.deleteMany({ shopId: shop._id }),
    StarCustomer.deleteMany({ shopId: shop._id }),
    User.updateMany({ favoriteShopIds: shop._id }, { $pull: { favoriteShopIds: shop._id } }),
  ]);
  await Shop.deleteOne({ _id: shop._id });
  revalidateTag(shopTag(shop.slug), { expire: 0 });
  return { cancelledOrders: cancelled.modifiedCount };
}
