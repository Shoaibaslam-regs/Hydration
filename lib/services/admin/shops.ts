import "server-only";
import { revalidateTag } from "next/cache";
import { Types } from "mongoose";
import { canAdminMoveShop, SHOP_REASON_REQUIRED, type ShopStatus } from "@/lib/admin/shop-status";
import { ApiError } from "@/lib/api/errors";
import type { SessionUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { Order, Product, Shop, User } from "@/lib/db/models";
import { paginated, skipFor, type Paginated } from "@/lib/validation/pagination";
import type { AdminShopListQuery } from "@/lib/validation/admin";
import { toShopSubscription, type ShopSubscription } from "../billing";
import { removeShopData } from "../shop-removal";
import { shopTag } from "../shops";
import { listAdminActions, logAdminAction, type AuditEntry } from "./audit";

export type AdminShopSummary = {
  id: string;
  slug: string;
  name: string;
  city: string;
  area: string;
  status: ShopStatus;
  isClosed: boolean;
  hasVerifiedBadge: boolean;
  owner: { id: string; name: string; email: string } | null;
  createdAt: string;
};

export type AdminShopDetail = AdminShopSummary & {
  description: string;
  phone: string;
  addressLine1: string;
  location: { lat: number; lng: number };
  deliveryRadiusKm: number;
  deliveryFee: number;
  hours: { opensAt: string; closesAt: string };
  statusReason: string;
  verifiedAt: string | null;
  rating: { average: number; count: number };
  productCount: number;
  orderCount: number;
  ownerStatus: "active" | "suspended" | null;
  closure: { by: "shopkeeper" | "admin"; at: string; reason: string } | null;
  plan: ShopSubscription;
  badgeGrantedAt: string | null;
  history: AuditEntry[];
};

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Pending shops first, then newest.
const STATUS_ORDER = { pending: 0, rejected: 1, verified: 2, suspended: 3 } as const;

export async function listAdminShops(query: AdminShopListQuery): Promise<Paginated<AdminShopSummary>> {
  await connectDB();
  const match: Record<string, unknown> = {};
  if (query.status) match.status = query.status;
  if (query.q) {
    const rx = new RegExp(escapeRegex(query.q), "i");
    match.$or = [{ name: rx }, { slug: rx }, { "address.city": rx }, { "address.area": rx }, { phone: rx }];
  }

  const [rows, total] = await Promise.all([
    Shop.aggregate<{
      _id: Types.ObjectId;
      slug: string;
      name: string;
      address: { city: string; area?: string };
      status: ShopStatus;
      ownerId: Types.ObjectId;
      closure?: { by: string } | null;
      verifiedBadge?: { grantedAt: Date } | null;
      createdAt: Date;
    }>([
      { $match: match },
      {
        $addFields: {
          statusOrder: {
            $switch: {
              branches: Object.entries(STATUS_ORDER).map(([k, v]) => ({ case: { $eq: ["$status", k] }, then: v })),
              default: 9,
            },
          },
        },
      },
      { $sort: { statusOrder: 1, createdAt: -1, _id: 1 } },
      { $skip: skipFor(query) },
      { $limit: query.limit },
      { $project: { slug: 1, name: 1, address: 1, status: 1, ownerId: 1, createdAt: 1, closure: 1, verifiedBadge: 1 } },
    ]),
    Shop.countDocuments(match),
  ]);

  const owners = await User.find({ _id: { $in: rows.map((r) => r.ownerId) } }, { name: 1, email: 1 }).lean();
  const ownerById = new Map(owners.map((o) => [o._id.toString(), o]));

  return paginated(
    rows.map((r) => {
      const o = ownerById.get(r.ownerId.toString());
      return {
        id: r._id.toString(),
        slug: r.slug,
        name: r.name,
        city: r.address.city,
        area: r.address.area ?? "",
        status: r.status,
        isClosed: Boolean(r.closure),
        hasVerifiedBadge: Boolean(r.verifiedBadge),
        owner: o ? { id: o._id.toString(), name: o.name, email: o.email } : null,
        createdAt: r.createdAt.toISOString(),
      };
    }),
    total,
    query,
  );
}

export async function getAdminShop(shopId: string): Promise<AdminShopDetail | null> {
  if (!Types.ObjectId.isValid(shopId)) return null;
  await connectDB();
  const s = await Shop.findById(shopId).lean();
  if (!s) return null;
  const [owner, productCount, orderCount, history] = await Promise.all([
    User.findById(s.ownerId, { name: 1, email: 1, status: 1 }).lean(),
    Product.countDocuments({ shopId: s._id }),
    Order.countDocuments({ shopId: s._id }),
    listAdminActions("shop", shopId),
  ]);
  const [lng, lat] = s.location.coordinates;
  return {
    id: s._id.toString(),
    slug: s.slug,
    name: s.name,
    city: s.address.city,
    area: s.address.area ?? "",
    status: s.status as ShopStatus,
    owner: owner ? { id: owner._id.toString(), name: owner.name, email: owner.email } : null,
    createdAt: s.createdAt.toISOString(),
    description: s.description ?? "",
    phone: s.phone,
    addressLine1: s.address.line1,
    location: { lat, lng },
    deliveryRadiusKm: s.deliveryRadiusKm ?? 0,
    deliveryFee: s.deliveryFee ?? 0,
    hours: { opensAt: s.hours?.opensAt ?? "", closesAt: s.hours?.closesAt ?? "" },
    statusReason: s.statusReason ?? "",
    isClosed: Boolean(s.closure),
    hasVerifiedBadge: Boolean(s.verifiedBadge),
    badgeGrantedAt: s.verifiedBadge ? s.verifiedBadge.grantedAt.toISOString() : null,
    plan: toShopSubscription(s.subscription, new Date()),
    closure: s.closure
      ? { by: s.closure.by as "shopkeeper" | "admin", at: s.closure.at.toISOString(), reason: s.closure.reason ?? "" }
      : null,
    verifiedAt: s.verifiedAt ? s.verifiedAt.toISOString() : null,
    rating: { average: s.rating?.average ?? 0, count: s.rating?.count ?? 0 },
    productCount,
    orderCount,
    ownerStatus: (owner?.status as "active" | "suspended" | undefined) ?? null,
    history,
  };
}

/** Verify, reject, suspend or reinstate a shop. Updates the public page immediately. */
export async function setShopStatus(
  admin: SessionUser,
  shopId: string,
  to: ShopStatus,
  reason?: string,
): Promise<void> {
  await connectDB();
  const shop = await Shop.findById(shopId, { status: 1, slug: 1 }).lean();
  if (!shop) throw ApiError.notFound("Shop not found");
  const from = shop.status as ShopStatus;
  if (!canAdminMoveShop(from, to)) throw ApiError.conflict(`Can't change a shop from "${from}" to "${to}"`);
  if (SHOP_REASON_REQUIRED.includes(to) && !reason) {
    throw ApiError.badRequest("A reason is required; the shopkeeper will see it", { fieldErrors: { reason: ["Reason is required"] } });
  }

  const $set: Record<string, unknown> = { status: to, statusReason: SHOP_REASON_REQUIRED.includes(to) ? reason : "" };
  if (to === "verified") $set.verifiedAt = new Date();
  const res = await Shop.updateOne({ _id: shop._id, status: from }, { $set });
  if (res.modifiedCount === 0) throw ApiError.conflict("This shop was just updated. Refresh and try again.");

  await logAdminAction(admin, `shop.${to}`, "shop", shop._id, reason ?? "");
  revalidateTag(shopTag(shop.slug), { expire: 0 });
}

/** Close a shop on behalf of the platform. The shopkeeper can't reopen it; only an admin can. */
export async function adminCloseShop(admin: SessionUser, shopId: string, reason: string): Promise<void> {
  await connectDB();
  const shop = await Shop.findById(shopId, { slug: 1, closure: 1 }).lean();
  if (!shop) throw ApiError.notFound("Shop not found");
  if (shop.closure?.by === "admin") throw ApiError.conflict("This shop is already closed by an admin");
  // Also takes over a shopkeeper's own closure, so they can't reopen it.
  await Shop.updateOne({ _id: shop._id }, { $set: { closure: { by: "admin", at: new Date(), reason } } });
  await logAdminAction(admin, "shop.closed", "shop", shop._id, reason);
  revalidateTag(shopTag(shop.slug), { expire: 0 });
}

/** Reopen a closed shop (whoever closed it). */
export async function adminReopenShop(admin: SessionUser, shopId: string): Promise<void> {
  await connectDB();
  const shop = await Shop.findOneAndUpdate({ _id: shopId, closure: { $ne: null } }, { $set: { closure: null } }, { projection: { slug: 1 } }).lean();
  if (!shop) {
    if (!(await Shop.exists({ _id: shopId }))) throw ApiError.notFound("Shop not found");
    throw ApiError.conflict("This shop is already open");
  }
  await logAdminAction(admin, "shop.reopened", "shop", shop._id);
  revalidateTag(shopTag(shop.slug), { expire: 0 });
}

/** Permanently remove a shop (see removeShopData). The owner's account stays, so they could register again. */
export async function adminRemoveShop(admin: SessionUser, shopId: string, reason: string): Promise<{ cancelledOrders: number }> {
  await connectDB();
  const shop = await Shop.findById(shopId, { slug: 1, name: 1, ownerId: 1 }).lean();
  if (!shop) throw ApiError.notFound("Shop not found");
  const result = await removeShopData(shop, "admin", `Shop removed: ${reason}`);
  const note = `${shop.name}: ${reason}`.slice(0, 500);
  await logAdminAction(admin, "shop.removed", "shop", shop._id, note);
  // Also on the owner, since the shop's own page no longer exists.
  await logAdminAction(admin, "shop.removed", "user", shop.ownerId, note);
  return result;
}

/** Give a shop the public "Verified" trust badge. */
export async function grantVerifiedBadge(admin: SessionUser, shopId: string, note = ""): Promise<void> {
  await connectDB();
  const shop = await Shop.findOneAndUpdate(
    { _id: shopId, verifiedBadge: null },
    { $set: { verifiedBadge: { grantedAt: new Date(), grantedBy: new Types.ObjectId(admin.id) } } },
    { projection: { slug: 1 } },
  ).lean();
  if (!shop) {
    if (!(await Shop.exists({ _id: shopId }))) throw ApiError.notFound("Shop not found");
    throw ApiError.conflict("This shop already has the verified badge");
  }
  await logAdminAction(admin, "shop.badge.granted", "shop", shop._id, note);
  revalidateTag(shopTag(shop.slug), { expire: 0 });
}

/** Remove the badge. A reason is required and kept in the admin history. */
export async function revokeVerifiedBadge(admin: SessionUser, shopId: string, reason: string): Promise<void> {
  await connectDB();
  const shop = await Shop.findOneAndUpdate(
    { _id: shopId, verifiedBadge: { $ne: null } },
    { $set: { verifiedBadge: null } },
    { projection: { slug: 1 } },
  ).lean();
  if (!shop) {
    if (!(await Shop.exists({ _id: shopId }))) throw ApiError.notFound("Shop not found");
    throw ApiError.conflict("This shop doesn't have the verified badge");
  }
  await logAdminAction(admin, "shop.badge.revoked", "shop", shop._id, reason);
  revalidateTag(shopTag(shop.slug), { expire: 0 });
}
