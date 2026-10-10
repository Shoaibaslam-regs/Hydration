import "server-only";
import { Types } from "mongoose";
import { ApiError } from "@/lib/api/errors";
import type { ProductType } from "@/lib/catalog";
import { connectDB } from "@/lib/db/connect";
import { Order } from "@/lib/db/models";
import {
  canShopkeeperMove,
  REASON_REQUIRED,
  SHOPKEEPER_TRANSITIONS,
  type OrderStatus,
} from "@/lib/orders/status";
import { paginated, skipFor, type Paginated } from "@/lib/validation/pagination";
import type { OrderListQuery, OrderStatusUpdate } from "@/lib/validation/shopkeeper";
import type { MyShop } from "./my-shop";

export type ShopOrderSummary = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  /** Minor currency units. */
  total: number;
  itemCount: number;
  contactName: string;
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

function toSummary(o: OrderLean): ShopOrderSummary {
  return {
    id: o._id.toString(),
    orderNumber: o.orderNumber,
    status: o.status as OrderStatus,
    total: o.total,
    itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
    contactName: o.contactName,
    place: [o.deliveryAddress.area, o.deliveryAddress.city].filter(Boolean).join(", "),
    createdAt: o.createdAt.toISOString(),
  };
}

function toDetail(o: OrderLean): ShopOrderDetail {
  const status = o.status as OrderStatus;
  return {
    ...toSummary(o),
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
  const filter: Record<string, unknown> = { shopId: new Types.ObjectId(shop.id) };
  if (query.status) filter.status = query.status;
  const [items, total] = await Promise.all([
    Order.find(filter, { statusHistory: 0 }).sort({ createdAt: -1, _id: -1 }).skip(skipFor(query)).limit(query.limit).lean(),
    Order.countDocuments(filter),
  ]);
  return paginated(items.map((o) => toSummary(o as unknown as OrderLean)), total, query);
}

export async function getShopOrder(shop: MyShop, orderId: string): Promise<ShopOrderDetail | null> {
  if (!Types.ObjectId.isValid(orderId)) return null;
  await connectDB();
  const o = await Order.findOne({ _id: orderId, shopId: shop.id }).lean();
  return o ? toDetail(o as unknown as OrderLean) : null;
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
