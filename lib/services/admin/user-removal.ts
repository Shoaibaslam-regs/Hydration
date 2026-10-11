import "server-only";
import { revalidateTag } from "next/cache";
import { Types } from "mongoose";
import { ApiError } from "@/lib/api/errors";
import { verifyPassword } from "@/lib/auth/password";
import type { SessionUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { Address, Order, PasswordReset, Review, Shop, StarCustomer, SupportThread, User } from "@/lib/db/models";
import { FINAL_ORDER_STATUSES, ORDER_STATUSES } from "@/lib/orders/status";
import { refreshShopRating } from "../reviews";
import { removeShopData } from "../shop-removal";
import { shopTag } from "../shops";
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

  const result = await removeUserData(user, "admin", reason);
  // Record who was deleted: the account itself no longer exists.
  await logAdminAction(admin, "user.deleted", "user", user._id, `${user.name} <${user.email}> (${user.role}): ${reason}`.slice(0, 500));
  return result;
}

/**
 * A customer or shopkeeper deletes their own account after re-entering their
 * password. Same clean-up as an admin deletion. Admin accounts can't delete
 * themselves this way (use another admin).
 */
export async function deleteMyAccount(sessionUser: SessionUser, password: string): Promise<UserRemovalResult> {
  await connectDB();
  if (sessionUser.role === "admin") throw ApiError.forbidden("Admin accounts are removed by another admin.");
  const user = await User.findById(sessionUser.id, { email: 1, name: 1, role: 1, passwordHash: 1 }).select("+passwordHash").lean();
  if (!user) throw ApiError.notFound("Account not found");
  if (!(await verifyPassword(password, user.passwordHash))) {
    throw ApiError.badRequest("That password isn't right", { fieldErrors: { password: ["That password isn't right"] } });
  }
  return removeUserData(user, "self", "Account deleted by its owner");
}

/** The shared clean-up behind both deletions. */
async function removeUserData(
  user: { _id: Types.ObjectId; role: string },
  by: "admin" | "self",
  reason: string,
): Promise<UserRemovalResult> {
  const result: UserRemovalResult = { role: user.role, cancelledOrders: 0, anonymizedOrders: 0, deletedReviews: 0, removedShop: false };
  const touchedShops = new Set<string>();
  const actor = by === "admin" ? "admin" : user.role === "shopkeeper" ? "shopkeeper" : "customer";

  // Shopkeeper: remove their shop first (cancels its unfinished orders, deletes its reviews).
  const shop = await Shop.findOne({ ownerId: user._id }, { slug: 1 }).lean();
  if (shop) {
    const removed = await removeShopData(shop, by === "admin" ? "admin" : "shopkeeper", by === "admin" ? `Shop removed: ${reason}` : "The shop has closed permanently");
    result.cancelledOrders += removed.cancelledOrders;
    result.removedShop = true;
  }

  // Customer orders: cancel unfinished ones (each claimed with its status as a precondition).
  const unfinished = ORDER_STATUSES.filter((s) => !FINAL_ORDER_STATUSES.includes(s));
  const open = await Order.find({ customerId: user._id, status: { $in: unfinished } }, { status: 1, shopId: 1, items: 1 }).lean();
  for (const o of open) {
    const claimed = await Order.updateOne(
      { _id: o._id, status: o.status },
      { $set: { status: "cancelled" }, $push: { statusHistory: { status: "cancelled", at: new Date(), by: actor, note: "Customer account deleted" } } },
    );
    if (claimed.modifiedCount === 0) continue;
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

  await Promise.all([
    Address.deleteMany({ userId: user._id }),
    PasswordReset.deleteMany({ userId: user._id }),
    SupportThread.deleteMany({ userId: user._id }),
    StarCustomer.deleteMany({ customerId: user._id }),
  ]);
  await User.deleteOne({ _id: user._id });

  const slugs = await Shop.find({ _id: { $in: [...touchedShops].map((id) => new Types.ObjectId(id)) } }, { slug: 1 }).lean();
  for (const s of slugs) revalidateTag(shopTag(s.slug), { expire: 0 });
  return result;
}
