import "server-only";
import { randomBytes } from "node:crypto";
import { revalidateTag } from "next/cache";
import { Types } from "mongoose";
import { ApiError } from "@/lib/api/errors";
import type { SessionUser } from "@/lib/auth/session";
import type { ProductType } from "@/lib/catalog";
import { connectDB } from "@/lib/db/connect";
import { Address, Order, Product, Review, Shop, User } from "@/lib/db/models";
import { distanceKm } from "@/lib/geo";
import { canCustomerMove, REVIEWABLE_STATUS, type OrderStatus } from "@/lib/orders/status";
import { paginated, skipFor, type Paginated, type Pagination } from "@/lib/validation/pagination";
import type { OrderCreateInput } from "@/lib/validation/customer";
import { shopTag } from "./shops";
import { returnStock } from "./stock";

export type CustomerOrderSummary = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  total: number;
  itemCount: number;
  shop: { name: string; slug: string };
  createdAt: string;
};

export type CustomerOrderDetail = CustomerOrderSummary & {
  items: { name: string; type: ProductType; sizeLiters: number | null; unitPrice: number; quantity: number; lineTotal: number }[];
  subtotal: number;
  deliveryFee: number;
  deliveryAddress: { line1: string; area: string; city: string; notes: string };
  contactPhone: string;
  shopPhone: string;
  payment: { method: string; status: string };
  history: { status: OrderStatus; at: string; note: string }[];
  canCancel: boolean;
  canReview: boolean;
  review: { rating: number; comment: string } | null;
};

const DUPLICATE_KEY = 11000;
const ORDER_NUMBER_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

function newOrderNumber(): string {
  const bytes = randomBytes(8);
  let s = "";
  for (const b of bytes) s += ORDER_NUMBER_ALPHABET[b % ORDER_NUMBER_ALPHABET.length];
  return `AQ-${s}`;
}

type Reserved = { productId: Types.ObjectId; quantity: number };


/**
 * Place an order. Prices, delivery fee and availability always come from the
 * database, never the client. Stock is reserved item by item with a
 * conditional decrement; if any item can't be reserved, earlier reservations
 * are released and nothing is created.
 */
export async function placeOrder(user: SessionUser, input: OrderCreateInput): Promise<{ id: string; orderNumber: string }> {
  await connectDB();
  const customerId = new Types.ObjectId(user.id);

  const shop = await Shop.findOne({ slug: input.shopSlug, status: "verified" }).lean();
  if (!shop) throw ApiError.notFound("This shop isn't taking orders right now");

  const address = await Address.findOne({ _id: input.addressId, userId: customerId }).lean();
  if (!address) throw ApiError.badRequest("Choose a delivery address", { fieldErrors: { addressId: ["Choose a delivery address"] } });

  const [shopLng, shopLat] = shop.location.coordinates;
  const [addrLng, addrLat] = address.location.coordinates;
  const km = distanceKm({ lat: shopLat, lng: shopLng }, { lat: addrLat, lng: addrLng });
  if (km > (shop.deliveryRadiusKm ?? 0)) {
    throw ApiError.badRequest(
      `This address is ${km.toFixed(1)} km away; ${shop.name} delivers within ${shop.deliveryRadiusKm} km.`,
      { fieldErrors: { addressId: ["Outside this shop's delivery area"] } },
    );
  }

  const ids = input.items.map((i) => new Types.ObjectId(i.productId));
  const products = await Product.find({ _id: { $in: ids }, shopId: shop._id, isActive: true }).lean();
  const byId = new Map(products.map((p) => [p._id.toString(), p]));
  if (products.length !== input.items.length) {
    throw ApiError.conflict("Some items are no longer available. Please review your order.");
  }

  const reserved: Reserved[] = [];
  for (const item of input.items) {
    const res = await Product.updateOne(
      { _id: item.productId, shopId: shop._id, isActive: true, stock: { $gte: item.quantity } },
      { $inc: { stock: -item.quantity } },
    );
    if (res.modifiedCount === 0) {
      await returnStock(shop._id, reserved);
      const p = byId.get(item.productId)!;
      const left = (await Product.findById(p._id, { stock: 1 }).lean())?.stock ?? 0;
      throw ApiError.conflict(
        left === 0 ? `${p.name} is out of stock` : `Only ${left} × ${p.name} left. Please lower the quantity.`,
      );
    }
    reserved.push({ productId: new Types.ObjectId(item.productId), quantity: item.quantity });
  }

  const items = input.items.map((item) => {
    const p = byId.get(item.productId)!;
    return {
      productId: p._id,
      name: p.name,
      type: p.type,
      sizeLiters: p.sizeLiters ?? undefined,
      unitPrice: p.price,
      quantity: item.quantity,
      lineTotal: p.price * item.quantity,
    };
  });
  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
  const deliveryFee = shop.deliveryFee ?? 0;
  const contactName = (await User.findById(customerId, { name: 1 }).lean())?.name ?? user.name;

  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const order = await Order.create({
          orderNumber: newOrderNumber(),
          customerId,
          shopId: shop._id,
          items,
          subtotal,
          deliveryFee,
          total: subtotal + deliveryFee,
          deliveryAddress: { line1: address.line1, area: address.area ?? "", city: address.city, notes: input.notes || address.notes || "" },
          contactName,
          contactPhone: input.contactPhone,
          status: "pending",
          statusHistory: [{ status: "pending", at: new Date(), by: "customer" }],
          payment: { method: "cash_on_delivery", status: "unpaid" },
        });
        revalidateTag(shopTag(shop.slug), { expire: 0 });
        return { id: order._id.toString(), orderNumber: order.orderNumber };
      } catch (err) {
        // Retry only on an order-number collision.
        if ((err as { code?: number; keyPattern?: Record<string, unknown> }).keyPattern?.orderNumber) continue;
        if ((err as { code?: number }).code === DUPLICATE_KEY) continue;
        throw err;
      }
    }
    throw new Error("Could not generate a unique order number");
  } catch (err) {
    await returnStock(shop._id, reserved);
    throw err;
  }
}

type OrderLean = {
  _id: Types.ObjectId;
  orderNumber: string;
  status: string;
  shopId: Types.ObjectId;
  total: number;
  subtotal: number;
  deliveryFee: number;
  items: { name: string; type: string; sizeLiters?: number | null; unitPrice: number; quantity: number; lineTotal: number; productId: Types.ObjectId }[];
  deliveryAddress: { line1: string; area?: string | null; city: string; notes?: string | null };
  contactPhone: string;
  payment: { method: string; status: string };
  statusHistory: { status: string; at: Date; note?: string | null }[];
  createdAt: Date;
};

async function shopNames(ids: Types.ObjectId[]) {
  const shops = await Shop.find({ _id: { $in: ids } }, { name: 1, slug: 1, phone: 1 }).lean();
  return new Map(shops.map((s) => [s._id.toString(), s]));
}

function toSummary(o: OrderLean, shop: { name: string; slug: string } | undefined): CustomerOrderSummary {
  return {
    id: o._id.toString(),
    orderNumber: o.orderNumber,
    status: o.status as OrderStatus,
    total: o.total,
    itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
    shop: { name: shop?.name ?? "Shop", slug: shop?.slug ?? "" },
    createdAt: o.createdAt.toISOString(),
  };
}

export async function listCustomerOrders(
  userId: string,
  query: Pagination & { status?: OrderStatus },
): Promise<Paginated<CustomerOrderSummary>> {
  await connectDB();
  const filter: Record<string, unknown> = { customerId: new Types.ObjectId(userId) };
  if (query.status) filter.status = query.status;
  const [rows, total] = await Promise.all([
    Order.find(filter, { statusHistory: 0 }).sort({ createdAt: -1, _id: -1 }).skip(skipFor(query)).limit(query.limit).lean(),
    Order.countDocuments(filter),
  ]);
  const orders = rows as unknown as OrderLean[];
  const shops = await shopNames([...new Set(orders.map((o) => o.shopId.toString()))].map((id) => new Types.ObjectId(id)));
  return paginated(orders.map((o) => toSummary(o, shops.get(o.shopId.toString()))), total, query);
}

export async function getCustomerOrder(userId: string, orderId: string): Promise<CustomerOrderDetail | null> {
  if (!Types.ObjectId.isValid(orderId)) return null;
  await connectDB();
  const o = (await Order.findOne({ _id: orderId, customerId: new Types.ObjectId(userId) }).lean()) as unknown as OrderLean | null;
  if (!o) return null;
  const [shops, review] = await Promise.all([shopNames([o.shopId]), Review.findOne({ orderId: o._id }).lean()]);
  const shop = shops.get(o.shopId.toString());
  const status = o.status as OrderStatus;
  return {
    ...toSummary(o, shop),
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
    deliveryAddress: {
      line1: o.deliveryAddress.line1,
      area: o.deliveryAddress.area ?? "",
      city: o.deliveryAddress.city,
      notes: o.deliveryAddress.notes ?? "",
    },
    contactPhone: o.contactPhone,
    shopPhone: shop?.phone ?? "",
    payment: { method: o.payment.method, status: o.payment.status },
    history: o.statusHistory.map((h) => ({ status: h.status as OrderStatus, at: h.at.toISOString(), note: h.note ?? "" })),
    canCancel: canCustomerMove(status, "cancelled"),
    canReview: status === REVIEWABLE_STATUS && !review,
    review: review ? { rating: review.rating, comment: review.comment ?? "" } : null,
  };
}

/** Customers can cancel only while the order is still pending. Stock is returned. */
export async function cancelCustomerOrder(userId: string, orderId: string, note?: string): Promise<void> {
  await connectDB();
  const updated = await Order.findOneAndUpdate(
    { _id: orderId, customerId: new Types.ObjectId(userId), status: "pending" },
    {
      $set: { status: "cancelled" },
      $push: { statusHistory: { status: "cancelled", at: new Date(), by: "customer", note: note || "Cancelled by customer" } },
    },
    { new: true },
  ).lean();
  if (!updated) {
    const exists = await Order.exists({ _id: orderId, customerId: new Types.ObjectId(userId) });
    if (!exists) throw ApiError.notFound("Order not found");
    throw ApiError.conflict("This order can no longer be cancelled. Please contact the shop.");
  }
  await returnStock(
    updated.shopId,
    updated.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
  );
  const shop = await Shop.findById(updated.shopId, { slug: 1 }).lean();
  if (shop) revalidateTag(shopTag(shop.slug), { expire: 0 });
}
