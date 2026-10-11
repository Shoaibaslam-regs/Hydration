import "server-only";
import { revalidateTag } from "next/cache";
import { Types } from "mongoose";
import { ApiError } from "@/lib/api/errors";
import type { SessionUser } from "@/lib/auth/session";
import { formatPrice, type ProductType } from "@/lib/catalog";
import { connectDB } from "@/lib/db/connect";
import { publicIdSearchRegex } from "@/lib/ids";
import { Order, Review, Shop, User } from "@/lib/db/models";
import { FINAL_ORDER_STATUSES, type OrderStatus } from "@/lib/orders/status";
import { paginated, skipFor, type Paginated, type Pagination } from "@/lib/validation/pagination";
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
  /** The customer's "CU-…" ID (empty if the account is gone). */
  customerPublicId: string;
  createdAt: string;
};

export type AdminOrderDetail = AdminOrderSummary & {
  items: { name: string; type: ProductType; quantity: number; unitPrice: number; lineTotal: number }[];
  subtotal: number;
  deliveryFee: number;
  customer: { id: string; publicId: string; name: string; email: string } | null;
  shopPublicId: string;
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
  const shops = await Shop.find({ _id: { $in: ids } }, { publicId: 1, name: 1, slug: 1 }).lean();
  return new Map(shops.map((s) => [s._id.toString(), s]));
}

function toSummary(o: OrderLean, shop: { _id: Types.ObjectId; name: string } | undefined, customerPublicId = ""): AdminOrderSummary {
  return {
    id: o._id.toString(),
    orderNumber: o.orderNumber,
    status: o.status as OrderStatus,
    total: o.total,
    itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
    shop: shop ? { id: shop._id.toString(), name: shop.name } : null,
    customerName: o.contactName,
    customerPublicId,
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
  const [shops, customers] = await Promise.all([
    shopsById([...new Set(orders.map((o) => o.shopId.toString()))].map((id) => new Types.ObjectId(id))),
    User.find({ _id: { $in: orders.map((o) => o.customerId) } }, { publicId: 1 }).lean(),
  ]);
  const customerIds = new Map(customers.map((u) => [u._id.toString(), u.publicId ?? ""]));
  return paginated(orders.map((o) => toSummary(o, shops.get(o.shopId.toString()), customerIds.get(o.customerId.toString()))), total, query);
}

export async function getAdminOrder(orderId: string): Promise<AdminOrderDetail | null> {
  if (!Types.ObjectId.isValid(orderId)) return null;
  await connectDB();
  const o = (await Order.findById(orderId).lean()) as unknown as OrderLean | null;
  if (!o) return null;
  const [shops, customer, adminHistory] = await Promise.all([
    shopsById([o.shopId]),
    User.findById(o.customerId, { publicId: 1, name: 1, email: 1 }).lean(),
    listAdminActions("order", orderId),
  ]);
  const status = o.status as OrderStatus;
  return {
    ...toSummary(o, shops.get(o.shopId.toString()), customer?.publicId ?? ""),
    items: o.items.map((i) => ({ name: i.name, type: i.type as ProductType, quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.lineTotal })),
    subtotal: o.subtotal,
    deliveryFee: o.deliveryFee,
    customer: customer ? { id: customer._id.toString(), publicId: customer.publicId ?? "", name: customer.name, email: customer.email } : null,
    shopPublicId: shops.get(o.shopId.toString())?.publicId ?? "",
    contactPhone: o.contactPhone,
    deliveryAddress: [o.deliveryAddress.line1, o.deliveryAddress.area, o.deliveryAddress.city].filter(Boolean).join(", "),
    payment: o.payment,
    history: o.statusHistory.map((h) => ({ status: h.status as OrderStatus, at: h.at.toISOString(), by: h.by, note: h.note ?? "" })),
    adminHistory,
    canCancel: !FINAL_ORDER_STATUSES.includes(status),
  };
}

/** Admin cancellation for disputes: any order that isn't final yet. */
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

export type ShopOrderStats = {
  shopId: string;
  /** Null when the shop has since been removed (its past orders remain). */
  shop: { publicId: string; name: string; area: string; city: string; status: string } | null;
  total: number;
  /** Waiting for the shop to accept or reject. */
  pending: number;
  /** Confirmed or out for delivery. */
  active: number;
  delivered: number;
  cancelledOrRejected: number;
  /** Value of delivered orders, minor units. */
  deliveredValue: number;
  lastOrderAt: string;
};

/**
 * One row per shop that has orders, for the admin Orders page: counts by
 * stage and the last order time. Shops with orders waiting come first.
 * `q` filters by shop name, area or city.
 */
export async function listShopOrderStats(query: Pagination & { q?: string }): Promise<Paginated<ShopOrderStats>> {
  await connectDB();
  const count = (statuses: string[]) => ({ $sum: { $cond: [{ $in: ["$status", statuses] }, 1, 0] } });
  const rx = query.q ? new RegExp(escapeRegex(query.q), "i") : null;
  const idRx = query.q ? publicIdSearchRegex(query.q) : null;
  const [result] = await Order.aggregate<{ items: (Omit<ShopOrderStats, "shopId" | "lastOrderAt" | "shop"> & { _id: Types.ObjectId; lastOrderAt: Date; shop?: { publicId?: string; name: string; address: { area?: string; city: string }; status: string } })[]; total: { n: number }[] }>([
    {
      $group: {
        _id: "$shopId",
        total: { $sum: 1 },
        pending: count(["pending"]),
        active: count(["confirmed", "out_for_delivery"]),
        delivered: count(["delivered"]),
        cancelledOrRejected: count(["cancelled", "rejected"]),
        deliveredValue: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, "$total", 0] } },
        lastOrderAt: { $max: "$createdAt" },
      },
    },
    { $lookup: { from: Shop.collection.name, localField: "_id", foreignField: "_id", as: "shop", pipeline: [{ $project: { publicId: 1, name: 1, address: 1, status: 1 } }] } },
    { $unwind: { path: "$shop", preserveNullAndEmptyArrays: true } },
    ...(rx ? [{ $match: { $or: [{ "shop.name": rx }, { "shop.address.area": rx }, { "shop.address.city": rx }, ...(idRx ? [{ "shop.publicId": idRx }] : [])] } }] : []),
    { $sort: { pending: -1, active: -1, lastOrderAt: -1, _id: 1 } },
    { $facet: { items: [{ $skip: skipFor(query) }, { $limit: query.limit }], total: [{ $count: "n" }] } },
  ]);
  return paginated(
    result.items.map((r) => ({
      shopId: r._id.toString(),
      shop: r.shop ? { publicId: r.shop.publicId ?? "", name: r.shop.name, area: r.shop.address.area ?? "", city: r.shop.address.city, status: r.shop.status } : null,
      total: r.total,
      pending: r.pending,
      active: r.active,
      delivered: r.delivered,
      cancelledOrRejected: r.cancelledOrRejected,
      deliveredValue: r.deliveredValue,
      lastOrderAt: r.lastOrderAt.toISOString(),
    })),
    result.total[0]?.n ?? 0,
    query,
  );
}

/** The header for one shop's orders page: its name (if it still exists) and its order counts. */
export async function getShopOrderStats(shopId: string): Promise<ShopOrderStats | null> {
  if (!Types.ObjectId.isValid(shopId)) return null;
  await connectDB();
  const id = new Types.ObjectId(shopId);
  const [shop, hasOrders] = await Promise.all([Shop.findById(id, { publicId: 1, name: 1, address: 1, status: 1 }).lean(), Order.exists({ shopId: id })]);
  if (!shop && !hasOrders) return null;
  const count = (statuses: string[]) => ({ $sum: { $cond: [{ $in: ["$status", statuses] }, 1, 0] } });
  const [s] = await Order.aggregate<{ total: number; pending: number; active: number; delivered: number; cancelledOrRejected: number; deliveredValue: number; lastOrderAt: Date | null }>([
    { $match: { shopId: id } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        pending: count(["pending"]),
        active: count(["confirmed", "out_for_delivery"]),
        delivered: count(["delivered"]),
        cancelledOrRejected: count(["cancelled", "rejected"]),
        deliveredValue: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, "$total", 0] } },
        lastOrderAt: { $max: "$createdAt" },
      },
    },
  ]);
  return {
    shopId,
    shop: shop ? { publicId: shop.publicId ?? "", name: shop.name, area: shop.address.area ?? "", city: shop.address.city, status: shop.status } : null,
    total: s?.total ?? 0,
    pending: s?.pending ?? 0,
    active: s?.active ?? 0,
    delivered: s?.delivered ?? 0,
    cancelledOrRejected: s?.cancelledOrRejected ?? 0,
    deliveredValue: s?.deliveredValue ?? 0,
    lastOrderAt: (s?.lastOrderAt ?? new Date(0)).toISOString(),
  };
}
