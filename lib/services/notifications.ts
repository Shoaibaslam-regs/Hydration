import "server-only";
import { Types } from "mongoose";
import type { SessionUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { Order, Shop, SponsoredCampaign, SubscriptionPayment } from "@/lib/db/models";

/**
 * Things waiting for this user, keyed by the dashboard link they belong to
 * (the nav shows each count on its link):
 * - admin: shops to approve, plan payments and sponsorship requests to review
 * - shopkeeper: new orders to accept or reject
 * - customer: orders the shop updated that the customer hasn't opened yet
 */
export async function getNotificationCounts(user: SessionUser): Promise<Record<string, number>> {
  await connectDB();
  if (user.role === "admin") {
    const [shops, payments, campaigns] = await Promise.all([
      Shop.countDocuments({ status: "pending" }),
      SubscriptionPayment.countDocuments({ status: "pending" }),
      SponsoredCampaign.countDocuments({ status: "pending" }),
    ]);
    return { "/admin/shops": shops, "/admin/subscriptions": payments, "/admin/ads": campaigns };
  }
  if (user.role === "shopkeeper") {
    const shop = await Shop.findOne({ ownerId: new Types.ObjectId(user.id) }, { _id: 1 }).lean();
    const newOrders = shop ? await Order.countDocuments({ shopId: shop._id, status: "pending" }) : 0;
    return { "/shop/orders": newOrders };
  }
  const unread = await Order.countDocuments({ customerId: new Types.ObjectId(user.id), customerUnread: true });
  return { "/account/orders": unread };
}
