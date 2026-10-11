import "server-only";
import { Types } from "mongoose";
import { ApiError } from "@/lib/api/errors";
import { connectDB } from "@/lib/db/connect";
import { Order, Shop, StarCustomer, User } from "@/lib/db/models";
import type { MyShop } from "./my-shop";

/**
 * Shops tag their regulars as "Star customers". A shop picks the customer
 * through one of its own orders, so it can only tag people who ordered from it
 * and never needs (or sees) their account id.
 */
export async function setStarCustomer(shop: MyShop, orderId: string, star: boolean): Promise<void> {
  if (!Types.ObjectId.isValid(orderId)) throw ApiError.notFound("Order not found");
  await connectDB();
  const order = await Order.findOne({ _id: orderId, shopId: shop.id }, { customerId: 1 }).lean();
  if (!order) throw ApiError.notFound("Order not found");
  const key = { shopId: new Types.ObjectId(shop.id), customerId: order.customerId };
  if (!star) {
    await StarCustomer.deleteOne(key);
    return;
  }
  if (!(await User.exists({ _id: order.customerId }))) throw ApiError.conflict("This customer's account has been deleted");
  await StarCustomer.updateOne(key, { $setOnInsert: key }, { upsert: true });
}

/** Which of these customers the shop has starred, in one query (for a page of orders). */
export async function starredCustomerIds(shopId: string, customerIds: Types.ObjectId[]): Promise<Set<string>> {
  if (customerIds.length === 0) return new Set();
  await connectDB();
  const rows = await StarCustomer.find({ shopId: new Types.ObjectId(shopId), customerId: { $in: customerIds } }, { customerId: 1 }).lean();
  return new Set(rows.map((r) => r.customerId.toString()));
}

export type StarCustomerDTO = { name: string; publicId: string; since: string };

/** The shop's star customers, newest first. */
export async function listMyStarCustomers(shopId: string, limit = 50): Promise<StarCustomerDTO[]> {
  await connectDB();
  const rows = await StarCustomer.find({ shopId: new Types.ObjectId(shopId) }).sort({ createdAt: -1 }).limit(limit).lean();
  const users = await User.find({ _id: { $in: rows.map((r) => r.customerId) } }, { name: 1, publicId: 1 }).lean();
  const byId = new Map(users.map((u) => [u._id.toString(), u]));
  return rows.flatMap((r) => {
    const u = byId.get(r.customerId.toString());
    return u ? [{ name: u.name, publicId: u.publicId ?? "", since: r.createdAt.toISOString() }] : [];
  });
}

export type StarredByShop = { slug: string; name: string; since: string };

/** Shops that tagged this customer as a star customer (approved shops only). */
export async function listShopsThatStarredMe(customerId: string): Promise<StarredByShop[]> {
  await connectDB();
  const rows = await StarCustomer.find({ customerId: new Types.ObjectId(customerId) }).sort({ createdAt: -1 }).limit(50).lean();
  const shops = await Shop.find({ _id: { $in: rows.map((r) => r.shopId) }, status: "verified" }, { slug: 1, name: 1 }).lean();
  const byId = new Map(shops.map((s) => [s._id.toString(), s]));
  return rows.flatMap((r) => {
    const s = byId.get(r.shopId.toString());
    return s ? [{ slug: s.slug, name: s.name, since: r.createdAt.toISOString() }] : [];
  });
}

export async function isStarCustomerOf(customerId: string, shopId: string): Promise<boolean> {
  await connectDB();
  return Boolean(await StarCustomer.exists({ customerId: new Types.ObjectId(customerId), shopId: new Types.ObjectId(shopId) }));
}
