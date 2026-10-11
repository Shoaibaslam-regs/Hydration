import "server-only";
import { revalidateTag } from "next/cache";
import { Types } from "mongoose";
import { ApiError } from "@/lib/api/errors";
import type { SessionUser } from "@/lib/auth/session";
import { formatPrice, type ProductType } from "@/lib/catalog";
import { connectDB } from "@/lib/db/connect";
import { Order, Review, Shop, User } from "@/lib/db/models";
import { FINAL_ORDER_STATUSES, type OrderStatus } from "@/lib/orders/status";
import { paginated, skipFor, type Paginated } from "@/lib/validation/pagination";
import type { AdminOrderListQuery } from "@/lib/validation/admin";
import { refreshShopRating } from "../reviews";
import { shopTag } from "../shops";
import { listAdminActions, logAdminAction, type AuditEntry } from "./audit";

export type AdminOrderSummary = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  total: number;
  itemCount: number;
  shop: { id: string; name: string } | null;
  customerName: string;
  createdAt: string;
};

export type AdminOrderDetail = AdminOrderSummary & {
  items: { name: string; type: ProductType; quantity: number; unitPrice: number; lineTotal: number }[];
  subtotal: number;
  deliveryFee: number;
  customer: { id: string; name: string; email: string } | null;
  contactPhone: string;
  deliveryAddress: string;
  payment: { method: string; status: string };
  history: { status: OrderStatus; at: string; by: string; note: string }[];
  adminHistory: AuditEntry[];
  canCancel: boolean;
};

type OrderLean = {
  _id: Types.ObjectId;
  orderNumber: string;
  status: string;
  total: number;
  subtotal: number;
  deliveryFee: number;
  shopId: Types.ObjectId;
  customerId: Types.ObjectId;
  contactName: string;
  contactPhone: string;
  items: { productId: Types.ObjectId; name: string; type: string; quantity: number; unitPrice: number; lineTotal: number }[];
  deliveryAddress: { line1: string; area?: string | null; city: string };
  payment: { method: string; status: string };
  statusHistory: { status: string; at: Date; by: string; note?: string | null }[];
  createdAt: Date;
};

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function shopsById(ids: Types.ObjectId[]) {
  const shops = await Shop.find({ _id: { $in: ids } }, { name: 1, slug: 1 }).lean();
  return new Map(shops.map((s) => [s._id.toString(), s]));
}

function toSummary(o: OrderLean, shop: { _id: Types.ObjectId; name: string } | undefined): AdminOrderSummary {
  return {
    id: o._id.toString(),
    orderNumber: o.orderNumber,
    status: o.status as OrderStatus,
    total: o.total,
    itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
    shop: shop ? { id: shop._id.toString(), name: shop.name } : null,
    customerName: o.contactName,
    createdAt: o.createdAt.toISOString(),
  };
}

export async function listAdminOrders(query: AdminOrderListQuery): Promise<Paginated<AdminOrderSummary>> {
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.shopId) filter.shopId = new Types.ObjectId(query.shopId);
  if (query.q) filter.orderNumber = new RegExp(`^${escapeRegex(query.q.toUpperCase())}`);
  const [rows, total] = await Promise.all([
    Order.find(filter, { statusHistory: 0 }).sort({ createdAt: -1, _id: -1 }).skip(skipFor(query)).limit(query.limit).lean(),
    Order.countDocuments(filter),
  ]);
  const orders = rows as unknown as OrderLean[];
  const shops = await shopsById([...new Set(orders.map((o) => o.shopId.toString()))].map((id) => new Types.ObjectId(id)));
  return paginated(orders.map((o) => toSummary(o, shops.get(o.shopId.toString()))), total, query);
}

export async function getAdminOrder(orderId: string): Promise<AdminOrderDetail | null> {
  if (!Types.ObjectId.isValid(orderId)) return null;
  await connectDB();
  const o = (await Order.findById(orderId).lean()) as unknown as OrderLean | null;
  if (!o) return null;
  const [shops, customer, adminHistory] = await Promise.all([
    shopsById([o.shopId]),
    User.findById(o.customerId, { name: 1, email: 1 }).lean(),
    listAdminActions("order", orderId),
  ]);
  const status = o.status as OrderStatus;
  return {
    ...toSummary(o, shops.get(o.shopId.toString())),
    items: o.items.map((i) => ({ name: i.name, type: i.type as ProductType, quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.lineTotal })),
    subtotal: o.subtotal,
    deliveryFee: o.deliveryFee,
    customer: customer ? { id: customer._id.toString(), name: customer.name, email: customer.email } : null,
    contactPhone: o.contactPhone,
    deliveryAddress: [o.deliveryAddress.line1, o.deliveryAddress.area, o.deliveryAddress.city].filter(Boolean).join(", "),
    payment: o.payment,
    history: o.statusHistory.map((h) => ({ status: h.status as OrderStatus, at: h.at.toISOString(), by: h.by, note: h.note ?? "" })),
    adminHistory,
    canCancel: !FINAL_ORDER_STATUSES.includes(status),
  };
}

/** Admin cancellation for disputes: any order that isn't final yet. Returns stock. */
export async function adminCancelOrder(admin: SessionUser, orderId: string, reason: string): Promise<void> {
  await connectDB();
  const order = await Order.findById(orderId, { status: 1, shopId: 1, items: 1 }).lean();
  if (!order) throw ApiError.notFound("Order not found");
  const from = order.status as OrderStatus;
  if (FINAL_ORDER_STATUSES.includes(from)) throw ApiError.conflict(`This order is already ${from}`);

  const res = await Order.updateOne(
    { _id: order._id, status: from },
    {
      $set: { status: "cancelled", customerUnread: true },
      $push: { statusHistory: { status: "cancelled", at: new Date(), by: "admin", note: reason } },
    },
  );
  if (res.modifiedCount === 0) throw ApiError.conflict("This order was just updated. Refresh and try again.");

  await logAdminAction(admin, "order.cancel", "order", order._id, reason);
  const shop = await Shop.findById(order.shopId, { slug: 1 }).lean();
  if (shop) revalidateTag(shopTag(shop.slug), { expire: 0 });
}

/**
 * Permanently delete a finished order (and its review). Removes it from
 * everyone's history and from sales reports, so it's for test orders and
 * mistakes. Unfinished orders must be cancelled first.
 */
export async function deleteOrderAsAdmin(admin: SessionUser, orderId: string): Promise<void> {
  await connectDB();
  if (!Types.ObjectId.isValid(orderId)) throw ApiError.notFound("Order not found");
  const order = await Order.findOneAndDelete({ _id: orderId, status: { $in: FINAL_ORDER_STATUSES } }).lean();
  if (!order) {
    if (!(await Order.exists({ _id: orderId }))) throw ApiError.notFound("Order not found");
    throw ApiError.conflict("Only finished orders can be deleted. Cancel it first.");
  }
  const review = await Review.findOneAndDelete({ orderId: order._id }).lean();
  if (review) await refreshShopRating(order.shopId);
  await logAdminAction(admin, "order.deleted", "shop", order.shopId, `${order.orderNumber} · ${order.status} · ${formatPrice(order.total)}`);
  const shop = await Shop.findById(order.shopId, { slug: 1 }).lean();
  if (shop) revalidateTag(shopTag(shop.slug), { expire: 0 });
}
