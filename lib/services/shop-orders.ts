import "server-only";
import { Types } from "mongoose";
import { ApiError } from "@/lib/api/errors";
import type { ProductType } from "@/lib/catalog";
import { connectDB } from "@/lib/db/connect";
import { Order, User } from "@/lib/db/models";
import {
  canShopkeeperMove,
  FINAL_ORDER_STATUSES,
  REASON_REQUIRED,
  SHOPKEEPER_TRANSITIONS,
  type OrderStatus,
} from "@/lib/orders/status";
import { paginated, skipFor, type Paginated } from "@/lib/validation/pagination";
import type { OrderListQuery, OrderStatusUpdate } from "@/lib/validation/shopkeeper";
import type { MyShop } from "./my-shop";
import { starredCustomerIds } from "./star-customers";

export type ShopOrderSummary = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  /** Minor currency units. */
  total: number;
  itemCount: number;
  contactName: string;
  /** The customer's "CU-…" ID, so the shop can quote it to support (empty if the account is gone). */
  customerPublicId: string;
  /** The shop tagged this customer as a regular ("Star customer"). */
  isStarCustomer: boolean;
  place: string;
  createdAt: string;
};

export type ShopOrderDetail = ShopOrderSummary & {
  items: { name: string; type: ProductType; sizeLiters: number | null; unitPrice: number; quantity: number; lineTotal: number }[];
  subtotal: number;
  deliveryFee: number;
  contactPhone: string;
  deliveryAddress: { line1: string; area: string; city: string; notes: string };
  payment: { method: string; status: string };
  history: { status: OrderStatus; at: string; by: string; note: string }[];
  nextStatuses: OrderStatus[];
};

type OrderLean = {
  _id: Types.ObjectId;
  customerId: Types.ObjectId;
  orderNumber: string;
  status: string;
  total: number;
  subtotal: number;
  deliveryFee: number;
  items: { productId: Types.ObjectId; name: string; type: string; sizeLiters?: number | null; unitPrice: number; quantity: number; lineTotal: number }[];
  contactName: string;
  contactPhone: string;
  deliveryAddress: { line1: string; area?: string | null; city: string; notes?: string | null };
  payment: { method: string; status: string };
  statusHistory: { status: string; at: Date; by: string; note?: string | null }[];
  createdAt: Date;
};

function toSummary(o: OrderLean, customerPublicId = "", isStarCustomer = false): ShopOrderSummary {
  return {
    id: o._id.toString(),
    orderNumber: o.orderNumber,
    status: o.status as OrderStatus,
    total: o.total,
    itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
    contactName: o.contactName,
    customerPublicId,
    isStarCustomer,
    place: [o.deliveryAddress.area, o.deliveryAddress.city].filter(Boolean).join(", "),
    createdAt: o.createdAt.toISOString(),
  };
}

function toDetail(o: OrderLean, customerPublicId = "", isStarCustomer = false): ShopOrderDetail {
  const status = o.status as OrderStatus;
  return {
    ...toSummary(o, customerPublicId, isStarCustomer),
    items: o.items.map((i) => ({
      name: i.name,
      type: i.type as ProductType,
      sizeLiters: i.sizeLiters ?? null,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      lineTotal: i.lineTotal,
    })),
    subtotal: o.subtotal,
    deliveryFee: o.deliveryFee,
    contactPhone: o.contactPhone,
    deliveryAddress: {
      line1: o.deliveryAddress.line1,
      area: o.deliveryAddress.area ?? "",
      city: o.deliveryAddress.city,
      notes: o.deliveryAddress.notes ?? "",
    },
    payment: { method: o.payment.method, status: o.payment.status },
    history: o.statusHistory.map((h) => ({
      status: h.status as OrderStatus,
      at: h.at.toISOString(),
      by: h.by,
      note: h.note ?? "",
    })),
    nextStatuses: [...SHOPKEEPER_TRANSITIONS[status]],
  };
}

export async function listShopOrders(shop: MyShop, query: OrderListQuery): Promise<Paginated<ShopOrderSummary>> {
  await connectDB();
  const filter: Record<string, unknown> = { shopId: new Types.ObjectId(shop.id), hiddenForShop: { $ne: true } };
  if (query.status) filter.status = query.status;
  const [items, total] = await Promise.all([
    Order.find(filter, { statusHistory: 0 }).sort({ createdAt: -1, _id: -1 }).skip(skipFor(query)).limit(query.limit).lean(),
    Order.countDocuments(filter),
  ]);
  const customers = items.map((o) => o.customerId);
  const [ids, stars] = await Promise.all([customerPublicIds(customers), starredCustomerIds(shop.id, customers)]);
  return paginated(
    items.map((o) => toSummary(o as unknown as OrderLean, ids.get(o.customerId.toString()), stars.has(o.customerId.toString()))),
    total,
    query,
  );
}

/** customerId → "CU-…" for a page of orders, in one query. */
async function customerPublicIds(customerIds: Types.ObjectId[]): Promise<Map<string, string>> {
  const users = await User.find({ _id: { $in: customerIds } }, { publicId: 1 }).lean();
  return new Map(users.map((u) => [u._id.toString(), u.publicId ?? ""]));
}

export async function getShopOrder(shop: MyShop, orderId: string): Promise<ShopOrderDetail | null> {
  if (!Types.ObjectId.isValid(orderId)) return null;
  await connectDB();
  const o = await Order.findOne({ _id: orderId, shopId: shop.id }).lean();
  if (!o) return null;
  const [ids, stars] = await Promise.all([customerPublicIds([o.customerId]), starredCustomerIds(shop.id, [o.customerId])]);
  return toDetail(o as unknown as OrderLean, ids.get(o.customerId.toString()), stars.has(o.customerId.toString()));
}

/**
 * Move an order to its next status. Uses the current status as a precondition
 * so two concurrent updates can't both apply. Delivered cash orders are marked
 * paid, and the customer sees an unread dot until they open the order.
 */
export async function updateShopOrderStatus(
  shop: MyShop,
  orderId: string,
  update: OrderStatusUpdate,
): Promise<ShopOrderDetail> {
  await connectDB();
  const order = await Order.findOne({ _id: orderId, shopId: shop.id }).lean();
  if (!order) throw ApiError.notFound("Order not found");

  const from = order.status as OrderStatus;
  const to = update.status;
  if (!canShopkeeperMove(from, to)) {
    throw ApiError.conflict(`Can't change an order from "${from}" to "${to}"`);
  }
  if (REASON_REQUIRED.includes(to) && !update.note) {
    throw ApiError.badRequest("Please give the customer a reason", { fieldErrors: { note: ["Reason is required"] } });
  }

  const $set: Record<string, unknown> = { status: to, customerUnread: true };
  if (to === "delivered" && order.payment.method === "cash_on_delivery") $set["payment.status"] = "paid";

  const updated = await Order.findOneAndUpdate(
    { _id: order._id, shopId: shop.id, status: from },
    { $set, $push: { statusHistory: { status: to, at: new Date(), by: "shopkeeper", note: update.note } } },
    { new: true },
  ).lean();
  if (!updated) throw ApiError.conflict("This order was just updated. Refresh and try again.");

  return toDetail(updated as unknown as OrderLean);
}

/**
 * Remove a finished order from the shop's order list. It still counts in the
 * shop's sales reports, and the customer still sees it.
 */
export async function hideShopOrder(shop: MyShop, orderId: string): Promise<void> {
  await connectDB();
  const shopId = new Types.ObjectId(shop.id);
  const res = await Order.updateOne({ _id: orderId, shopId, status: { $in: FINAL_ORDER_STATUSES } }, { $set: { hiddenForShop: true } });
  if (res.matchedCount === 0) {
    if (!(await Order.exists({ _id: orderId, shopId }))) throw ApiError.notFound("Order not found");
    throw ApiError.conflict("Only finished orders can be removed. Finish, reject or cancel it first.");
  }
}

/** Remove every finished order from the shop's list. Returns how many. */
export async function clearShopOrderHistory(shop: MyShop): Promise<number> {
  await connectDB();
  const res = await Order.updateMany(
    { shopId: new Types.ObjectId(shop.id), status: { $in: FINAL_ORDER_STATUSES }, hiddenForShop: { $ne: true } },
    { $set: { hiddenForShop: true } },
  );
  return res.modifiedCount;
}
