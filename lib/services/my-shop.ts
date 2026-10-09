import "server-only";
import { randomBytes } from "node:crypto";
import { revalidateTag } from "next/cache";
import { Types } from "mongoose";
import { ApiError } from "@/lib/api/errors";
import { LOW_STOCK_THRESHOLD, toMinorUnits } from "@/lib/catalog";
import { connectDB } from "@/lib/db/connect";
import { Order, Product, Shop } from "@/lib/db/models";
import type { ShopStatus } from "@/lib/db/models/shop";
import type { ShopInput } from "@/lib/validation/shopkeeper";
import { removeShopData } from "./shop-removal";
import { shopTag } from "./shops";

/** The shopkeeper's own view of their shop (any status). */
export type MyShop = {
  id: string;
  slug: string;
  name: string;
  description: string;
  phone: string;
  address: { line1: string; area: string; city: string };
  location: { lat: number; lng: number };
  deliveryRadiusKm: number;
  /** Minor currency units. */
  deliveryFee: number;
  hours: { opensAt: string; closesAt: string };
  status: ShopStatus;
  statusReason: string;
  closure: { by: "shopkeeper" | "admin"; at: string; reason: string } | null;
};

type ShopLean = {
  _id: Types.ObjectId;
  slug: string;
  name: string;
  description?: string | null;
  phone: string;
  address: { line1: string; area?: string | null; city: string };
  location: { coordinates: number[] };
  deliveryRadiusKm?: number | null;
  deliveryFee?: number | null;
  hours?: { opensAt?: string | null; closesAt?: string | null } | null;
  status: string;
  statusReason?: string | null;
  closure?: { by: string; at: Date; reason?: string | null } | null;
};

function toMyShop(shop: ShopLean): MyShop {
  const [lng, lat] = shop.location.coordinates;
  return {
    id: shop._id.toString(),
    slug: shop.slug,
    name: shop.name,
    description: shop.description ?? "",
    phone: shop.phone,
    address: { line1: shop.address.line1, area: shop.address.area ?? "", city: shop.address.city },
    location: { lat, lng },
    deliveryRadiusKm: shop.deliveryRadiusKm ?? 0,
    deliveryFee: shop.deliveryFee ?? 0,
    hours: { opensAt: shop.hours?.opensAt ?? "08:00", closesAt: shop.hours?.closesAt ?? "22:00" },
    status: shop.status as ShopStatus,
    statusReason: shop.statusReason ?? "",
    closure: shop.closure
      ? { by: shop.closure.by as "shopkeeper" | "admin", at: shop.closure.at.toISOString(), reason: shop.closure.reason ?? "" }
      : null,
  };
}

function toDocFields(input: ShopInput) {
  return {
    name: input.name,
    description: input.description,
    phone: input.phone,
    address: input.address,
    location: { type: "Point" as const, coordinates: [input.location.lng, input.location.lat] },
    deliveryRadiusKm: input.deliveryRadiusKm,
    deliveryFee: toMinorUnits(input.deliveryFee),
    hours: input.hours,
  };
}

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "shop";
}

const DUPLICATE_KEY = 11000;

export async function getMyShop(ownerId: string): Promise<MyShop | null> {
  await connectDB();
  const shop = await Shop.findOne({ ownerId: new Types.ObjectId(ownerId) }).lean();
  return shop ? toMyShop(shop as unknown as ShopLean) : null;
}

/** For Route Handlers: the owner's shop, or 404 telling them to register one. */
export async function requireMyShop(ownerId: string): Promise<MyShop> {
  const shop = await getMyShop(ownerId);
  if (!shop) throw ApiError.notFound("Register your shop first");
  return shop;
}

/** Register a new shop. It starts as "pending" until an admin verifies it. */
export async function createMyShop(ownerId: string, input: ShopInput): Promise<MyShop> {
  await connectDB();
  const base = slugify(input.name);
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${randomBytes(2).toString("hex")}`;
    try {
      const shop = await Shop.create({ ...toDocFields(input), ownerId, slug, status: "pending" });
      return toMyShop(shop.toObject() as unknown as ShopLean);
    } catch (err) {
      const e = err as { code?: number; keyPattern?: Record<string, unknown> };
      if (e.code !== DUPLICATE_KEY) throw err;
      if (e.keyPattern?.ownerId) throw ApiError.conflict("You have already registered a shop");
      // Slug taken: retry with a suffix.
    }
  }
  throw ApiError.conflict("Couldn't create a unique shop address. Try a slightly different name.");
}

/**
 * Update the shop profile. The slug never changes so public links keep working.
 * Editing a rejected shop resubmits it for verification.
 */
export async function updateMyShop(ownerId: string, input: ShopInput): Promise<MyShop> {
  await connectDB();
  const current = await Shop.findOne({ ownerId: new Types.ObjectId(ownerId) }, { status: 1 }).lean();
  if (!current) throw ApiError.notFound("Register your shop first");
  if (current.status === "suspended") throw ApiError.forbidden("This shop is suspended. Contact support.");

  const resubmit = current.status === "rejected" ? { status: "pending", statusReason: "" } : {};
  const shop = await Shop.findOneAndUpdate(
    { _id: current._id },
    { $set: { ...toDocFields(input), ...resubmit } },
    { new: true, runValidators: true },
  ).lean();
  const result = toMyShop(shop as unknown as ShopLean);
  revalidateTag(shopTag(result.slug), { expire: 0 });
  return result;
}

/**
 * Temporarily close the shop: it disappears from search and stops taking new
 * orders. Existing orders can still be handled.
 */
export async function closeMyShop(ownerId: string, reason = ""): Promise<MyShop> {
  await connectDB();
  const owner = new Types.ObjectId(ownerId);
  const res = await Shop.updateOne(
    { ownerId: owner, closure: null },
    { $set: { closure: { by: "shopkeeper", at: new Date(), reason } } },
  );
  if (res.matchedCount === 0) {
    if (!(await Shop.exists({ ownerId: owner }))) throw ApiError.notFound("Register your shop first");
    throw ApiError.conflict("Your shop is already closed");
  }
  const shop = (await getMyShop(ownerId))!;
  revalidateTag(shopTag(shop.slug), { expire: 0 });
  return shop;
}

/** Reopen a shop the shopkeeper closed. A shop closed by an admin can only be reopened by an admin. */
export async function reopenMyShop(ownerId: string): Promise<MyShop> {
  await connectDB();
  const owner = new Types.ObjectId(ownerId);
  const res = await Shop.updateOne({ ownerId: owner, "closure.by": "shopkeeper" }, { $set: { closure: null } });
  if (res.matchedCount === 0) {
    const shop = await Shop.findOne({ ownerId: owner }, { closure: 1 }).lean();
    if (!shop) throw ApiError.notFound("Register your shop first");
    if (!shop.closure) throw ApiError.conflict("Your shop is already open");
    throw ApiError.forbidden("Your shop was closed by the Aqua team. Contact support to reopen it.");
  }
  const shop = (await getMyShop(ownerId))!;
  revalidateTag(shopTag(shop.slug), { expire: 0 });
  return shop;
}

/**
 * The owner permanently deletes their shop. They must type the shop's name to
 * confirm. Unfinished orders are cancelled; the account stays, so they can
 * register a new shop later (which goes through verification again).
 */
export async function deleteMyShop(ownerId: string, confirmName: string): Promise<{ cancelledOrders: number }> {
  await connectDB();
  const shop = await Shop.findOne({ ownerId: new Types.ObjectId(ownerId) }, { slug: 1, name: 1 }).lean();
  if (!shop) throw ApiError.notFound("You don't have a shop to delete");
  if (confirmName.trim().toLowerCase() !== shop.name.trim().toLowerCase()) {
    throw ApiError.badRequest("Type the shop's name exactly to confirm", { fieldErrors: { confirmName: ["Doesn't match your shop's name"] } });
  }
  return removeShopData(shop, "shopkeeper", "The shop has closed permanently");
}

export type MyShopStats = { activeProducts: number; lowStock: number; newOrders: number; activeOrders: number };

export async function getMyShopStats(shopId: string): Promise<MyShopStats> {
  await connectDB();
  const id = new Types.ObjectId(shopId);
  const [activeProducts, lowStock, newOrders, activeOrders] = await Promise.all([
    Product.countDocuments({ shopId: id, isActive: true }),
    Product.countDocuments({ shopId: id, isActive: true, stock: { $lte: LOW_STOCK_THRESHOLD } }),
    Order.countDocuments({ shopId: id, status: "pending" }),
    Order.countDocuments({ shopId: id, status: { $in: ["confirmed", "out_for_delivery"] } }),
  ]);
  return { activeProducts, lowStock, newOrders, activeOrders };
}
