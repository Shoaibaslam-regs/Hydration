import "server-only";
import { revalidateTag } from "next/cache";
import { Types } from "mongoose";
import { ApiError } from "@/lib/api/errors";
import type { SessionUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { Address, Order, PasswordReset, Review, Shop, User } from "@/lib/db/models";
import { FINAL_ORDER_STATUSES, ORDER_STATUSES } from "@/lib/orders/status";
import { refreshShopRating } from "../reviews";
import { removeShopData } from "../shop-removal";
import { shopTag } from "../shops";
import { returnStock } from "../stock";
import { logAdminAction } from "./audit";

export type UserRemovalResult = { role: string; cancelledOrders: number; anonymizedOrders: number; deletedReviews: number; removedShop: boolean };

/**
 * Permanently delete any account except the acting admin's. The admin must
 * type the user's email to confirm. Customers: unfinished orders are cancelled
 * (stock returned), past orders keep their totals but lose name, phone and
 * street address, and reviews, addresses and the account are deleted (shop
 * ratings are recalculated). Shopkeepers: their shop is removed first, via
 * the same steps as admin shop removal. Plan payment records are kept as
 * financial records.
 */
export async function deleteUserAccount(
  admin: SessionUser,
  userId: string,
  confirmEmail: string,
  reason: string,
): Promise<UserRemovalResult> {
  await connectDB();
  if (userId === admin.id) throw ApiError.forbidden("You can't delete your own account");
  const user = await User.findById(userId, { email: 1, name: 1, role: 1 }).lean();
  if (!user) throw ApiError.notFound("User not found");
  if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
    throw ApiError.badRequest("Type the user's email exactly to confirm", { fieldErrors: { confirmEmail: ["Doesn't match this user's email"] } });
  }

  const result: UserRemovalResult = { role: user.role, cancelledOrders: 0, anonymizedOrders: 0, deletedReviews: 0, removedShop: false };
  const touchedShops = new Set<string>();

  // Shopkeeper: remove their shop first (cancels its unfinished orders, deletes products and reviews).
  const shop = await Shop.findOne({ ownerId: user._id }, { slug: 1 }).lean();
  if (shop) {
    const removed = await removeShopData(shop, "admin", `Shop removed: ${reason}`);
    result.cancelledOrders += removed.cancelledOrders;
    result.removedShop = true;
  }

  // Customer orders: cancel unfinished ones (claim each so a concurrent update can't double-return stock).
  const unfinished = ORDER_STATUSES.filter((s) => !FINAL_ORDER_STATUSES.includes(s));
  const open = await Order.find({ customerId: user._id, status: { $in: unfinished } }, { status: 1, shopId: 1, items: 1 }).lean();
  for (const o of open) {
    const claimed = await Order.updateOne(
      { _id: o._id, status: o.status },
      { $set: { status: "cancelled" }, $push: { statusHistory: { status: "cancelled", at: new Date(), by: "admin", note: "Customer account deleted" } } },
    );
    if (claimed.modifiedCount === 0) continue;
    await returnStock(o.shopId, o.items);
    touchedShops.add(o.shopId.toString());
    result.cancelledOrders += 1;
  }

  // Keep past orders for shops' records, without personal details. Area and city stay for reports.
  const anonymized = await Order.updateMany(
    { customerId: user._id },
    {
      $set: {
        contactName: "Deleted customer",
        contactPhone: "—",
        "deliveryAddress.line1": "Removed",
        "deliveryAddress.notes": "",
      },
    },
  );
  result.anonymizedOrders = anonymized.modifiedCount;

  // Reviews: delete, then recalculate ratings of the shops they were for.
  const reviewShops = await Review.distinct("shopId", { customerId: user._id });
  result.deletedReviews = (await Review.deleteMany({ customerId: user._id })).deletedCount;
  for (const shopId of reviewShops) {
    await refreshShopRating(shopId as Types.ObjectId);
    touchedShops.add(String(shopId));
  }

  await Promise.all([Address.deleteMany({ userId: user._id }), PasswordReset.deleteMany({ userId: user._id })]);
  await User.deleteOne({ _id: user._id });

  // Record who was deleted: the account itself no longer exists.
  await logAdminAction(admin, "user.deleted", "user", user._id, `${user.name} <${user.email}> (${user.role}): ${reason}`.slice(0, 500));

  const slugs = await Shop.find({ _id: { $in: [...touchedShops].map((id) => new Types.ObjectId(id)) } }, { slug: 1 }).lean();
  for (const s of slugs) revalidateTag(shopTag(s.slug), { expire: 0 });
  return result;
}
