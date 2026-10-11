import "server-only";
import { revalidateTag } from "next/cache";
import { Types } from "mongoose";
import { ApiError } from "@/lib/api/errors";
import type { SessionUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { Order, Review, Shop } from "@/lib/db/models";
import { REVIEWABLE_STATUS } from "@/lib/orders/status";
import type { ReviewInput } from "@/lib/validation/customer";
import { logAdminAction } from "./admin/audit";
import { shopTag } from "./shops";

const DUPLICATE_KEY = 11000;

/** Recompute a shop's rating from all its reviews (keeps the stored average exact). */
export async function refreshShopRating(shopId: Types.ObjectId) {
  const [agg] = await Review.aggregate<{ avg: number; n: number }>([
    { $match: { shopId } },
    { $group: { _id: null, avg: { $avg: "$rating" }, n: { $sum: 1 } } },
  ]);
  await Shop.updateOne(
    { _id: shopId },
    { $set: { "rating.average": agg ? Math.round(agg.avg * 10) / 10 : 0, "rating.count": agg?.n ?? 0 } },
  );
}

/** Review a delivered order. One review per order. */
export async function createReview(user: SessionUser, orderId: string, input: ReviewInput): Promise<void> {
  await connectDB();
  const order = await Order.findOne({ _id: orderId, customerId: new Types.ObjectId(user.id) }, { status: 1, shopId: 1 }).lean();
  if (!order) throw ApiError.notFound("Order not found");
  if (order.status !== REVIEWABLE_STATUS) throw ApiError.conflict("You can review an order after it's delivered");

  try {
    await Review.create({
      orderId: order._id,
      shopId: order.shopId,
      customerId: new Types.ObjectId(user.id),
      authorName: user.name.split(" ")[0].slice(0, 40),
      rating: input.rating,
      comment: input.comment,
    });
  } catch (err) {
    if ((err as { code?: number }).code === DUPLICATE_KEY) throw ApiError.conflict("You've already reviewed this order");
    throw err;
  }

  await refreshShopRating(order.shopId);
  const shop = await Shop.findById(order.shopId, { slug: 1 }).lean();
  if (shop) revalidateTag(shopTag(shop.slug), { expire: 0 });
}

/** The customer deletes their own review. The shop's rating is recalculated. */
export async function deleteMyReview(user: SessionUser, orderId: string): Promise<void> {
  await connectDB();
  if (!Types.ObjectId.isValid(orderId)) throw ApiError.notFound("Review not found");
  const r = await Review.findOneAndDelete({ orderId, customerId: new Types.ObjectId(user.id) }).lean();
  if (!r) throw ApiError.notFound("Review not found");
  await afterReviewRemoved(r.shopId);
}

export type AdminReview = { id: string; authorName: string; rating: number; comment: string; createdAt: string };

/** A shop's latest reviews, for moderation on the admin shop page. */
export async function listShopReviewsForAdmin(shopId: string, limit = 30): Promise<AdminReview[]> {
  await connectDB();
  if (!Types.ObjectId.isValid(shopId)) return [];
  const rows = await Review.find({ shopId: new Types.ObjectId(shopId) }).sort({ createdAt: -1 }).limit(limit).lean();
  return rows.map((r) => ({ id: r._id.toString(), authorName: r.authorName, rating: r.rating, comment: r.comment ?? "", createdAt: r.createdAt.toISOString() }));
}

/** Admin deletes any review (abusive, fake…). Needs a reason; audited on the shop. */
export async function deleteReviewAsAdmin(admin: SessionUser, reviewId: string, reason: string): Promise<void> {
  await connectDB();
  if (!Types.ObjectId.isValid(reviewId)) throw ApiError.notFound("Review not found");
  const r = await Review.findOneAndDelete({ _id: reviewId }).lean();
  if (!r) throw ApiError.notFound("Review not found");
  await logAdminAction(admin, "review.deleted", "shop", r.shopId, `${r.rating}★ by ${r.authorName}: ${reason}`.slice(0, 500));
  await afterReviewRemoved(r.shopId);
}

async function afterReviewRemoved(shopId: Types.ObjectId) {
  await refreshShopRating(shopId);
  const shop = await Shop.findById(shopId, { slug: 1 }).lean();
  if (shop) revalidateTag(shopTag(shop.slug), { expire: 0 });
}
