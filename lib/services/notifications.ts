import "server-only";
import { Types } from "mongoose";
import type { SessionUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { Order, Shop, SponsoredCampaign, SubscriptionPayment, SupportThread } from "@/lib/db/models";

/**
 * Things waiting for this user, keyed by the dashboard link they belong to
 * (the nav shows each count on its link):
 * - admin: shops to approve, plan payments and sponsorship requests to review,
 *   support conversations with unread shopkeeper messages
 * - shopkeeper: new orders to accept or reject, unread replies from the Aqua team,
 *   and Billing while the shop is locked because its plan ended
 * - customer: orders the shop updated that the customer hasn't opened yet,
 *   unread replies from the Aqua team
 */
export async function getNotificationCounts(user: SessionUser): Promise<Record<string, number>> {
  await connectDB();
  if (user.role === "admin") {
    const [shops, payments, campaigns, support] = await Promise.all([
      Shop.countDocuments({ status: "pending" }),
      SubscriptionPayment.countDocuments({ status: "pending" }),
      SponsoredCampaign.countDocuments({ status: "pending" }),
      SupportThread.countDocuments({ unreadForAdmin: true }),
    ]);
    return { "/admin/shops": shops, "/admin/subscriptions": payments, "/admin/ads": campaigns, "/admin/support": support };
  }
  if (user.role === "shopkeeper") {
    const ownerId = new Types.ObjectId(user.id);
    const [shop, replies] = await Promise.all([
      Shop.findOne({ ownerId }, { _id: 1, status: 1, subscription: 1 }).lean(),
      SupportThread.countDocuments({ userId: ownerId, unreadForUser: true }),
    ]);
    const newOrders = shop ? await Order.countDocuments({ shopId: shop._id, status: "pending" }) : 0;
    // A locked shop (plan ended) gets a dot on Billing so the way out is obvious.
    const locked = shop?.status === "verified" && !(shop.subscription?.endsAt && shop.subscription.endsAt > new Date());
    return { "/shop/orders": newOrders, "/shop/support": replies, "/shop/billing": locked ? 1 : 0 };
  }
  const customerId = new Types.ObjectId(user.id);
  const [unread, replies] = await Promise.all([
    Order.countDocuments({ customerId, customerUnread: true }),
    SupportThread.countDocuments({ userId: customerId, unreadForUser: true }),
  ]);
  return { "/account/orders": unread, "/account/support": replies };
}
