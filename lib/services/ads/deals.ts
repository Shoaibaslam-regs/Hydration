import "server-only";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { Types } from "mongoose";
import { MAX_RUNNING_DEALS } from "@/lib/ads/constants";
import { ApiError } from "@/lib/api/errors";
import type { SessionUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { Deal, Shop } from "@/lib/db/models";
import { paginated, skipFor, type Paginated, type Pagination } from "@/lib/validation/pagination";
import type { DealInput } from "@/lib/validation/ads";
import { logAdminAction } from "../admin/audit";
import { listableShopFilter } from "../listing";
import type { MyShop } from "../my-shop";
import { shopTag } from "../shops";

export const DEALS_TAG = "ads-deals";
const DAY_MS = 24 * 60 * 60 * 1000;

export type DealDTO = {
  id: string;
  title: string;
  description: string;
  endsAt: string;
  createdAt: string;
  state: "running" | "ended" | "removed";
  removedBy: "shopkeeper" | "admin" | null;
  removedReason: string;
};

export type PublicDeal = {
  id: string;
  title: string;
  description: string;
  endsAt: string;
  shop: { slug: string; name: string; area: string; city: string; hasVerifiedBadge: boolean };
};

type DealLean = {
  _id: Types.ObjectId;
  shopId: Types.ObjectId;
  title: string;
  description?: string | null;
  endsAt: Date;
  createdAt: Date;
  removedAt?: Date | null;
  removedBy?: string | null;
  removedReason?: string | null;
};

function toDTO(d: DealLean, now: Date): DealDTO {
  return {
    id: d._id.toString(),
    title: d.title,
    description: d.description ?? "",
    endsAt: d.endsAt.toISOString(),
    createdAt: d.createdAt.toISOString(),
    state: d.removedAt ? "removed" : d.endsAt > now ? "running" : "ended",
    removedBy: (d.removedBy as DealDTO["removedBy"]) ?? null,
    removedReason: d.removedReason ?? "",
  };
}

const running = (now: Date) => ({ removedAt: null, endsAt: { $gt: now } });

/** Copy the shop's longest-running deal onto the shop (for search filters and cards) and refresh caches. */
export async function refreshShopDeal(shopId: Types.ObjectId | string): Promise<void> {
  const id = new Types.ObjectId(shopId);
  const top = await Deal.findOne({ shopId: id, ...running(new Date()) }).sort({ endsAt: -1 }).lean();
  const shop = await Shop.findOneAndUpdate(
    { _id: id },
    { $set: { featuredDeal: top ? { title: top.title, endsAt: top.endsAt } : null } },
    { projection: { slug: 1 } },
  ).lean();
  if (shop) revalidateTag(shopTag(shop.slug), { expire: 0 });
  revalidateTag(DEALS_TAG, { expire: 0 });
}

export async function listMyDeals(shop: MyShop): Promise<DealDTO[]> {
  await connectDB();
  const now = new Date();
  const rows = await Deal.find({ shopId: new Types.ObjectId(shop.id) }).sort({ createdAt: -1 }).limit(30).lean();
  return rows.map((d) => toDTO(d as unknown as DealLean, now));
}

/** Post a deal. It starts now and runs for `days`. At most MAX_RUNNING_DEALS at once. */
export async function createMyDeal(shop: MyShop, input: DealInput): Promise<DealDTO> {
  await connectDB();
  if (shop.status === "suspended") throw ApiError.forbidden("This shop is suspended. Contact support.");
  const now = new Date();
  const runningCount = await Deal.countDocuments({ shopId: new Types.ObjectId(shop.id), ...running(now) });
  if (runningCount >= MAX_RUNNING_DEALS) {
    throw ApiError.conflict(`You can run up to ${MAX_RUNNING_DEALS} deals at once. End one first.`);
  }
  const d = await Deal.create({
    shopId: shop.id,
    title: input.title,
    description: input.description,
    endsAt: new Date(now.getTime() + input.days * DAY_MS),
  });
  await refreshShopDeal(shop.id);
  return toDTO(d.toObject() as unknown as DealLean, now);
}

/** End a running deal early. */
export async function endMyDeal(shop: MyShop, dealId: string): Promise<void> {
  await connectDB();
  const res = await Deal.updateOne(
    { _id: dealId, shopId: new Types.ObjectId(shop.id), ...running(new Date()) },
    { $set: { removedAt: new Date(), removedBy: "shopkeeper" } },
  );
  if (res.matchedCount === 0) throw ApiError.notFound("No running deal with that id");
  await refreshShopDeal(shop.id);
}

/** A shop's running deals, for its public page (called inside the cached getShopBySlug). */
export async function runningDealsForShop(shopId: Types.ObjectId): Promise<{ id: string; title: string; description: string; endsAt: string }[]> {
  const rows = await Deal.find({ shopId, ...running(new Date()) }).sort({ endsAt: 1 }).lean();
  return rows.map((d) => ({ id: d._id.toString(), title: d.title, description: d.description ?? "", endsAt: d.endsAt.toISOString() }));
}

/** Newest deals from shops customers can see. Cached for the home page. */
export async function listLatestDeals(limit = 6): Promise<PublicDeal[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(DEALS_TAG);
  await connectDB();
  const now = new Date();
  const shopFilter = listableShopFilter(now);
  const rows = await Deal.aggregate<DealLean & { shop: { slug: string; name: string; address: { area?: string; city: string }; verifiedBadge?: unknown } }>([
    { $match: running(now) },
    { $sort: { createdAt: -1 } },
    { $limit: 50 },
    {
      $lookup: {
        from: Shop.collection.name,
        localField: "shopId",
        foreignField: "_id",
        as: "shop",
        pipeline: [{ $match: shopFilter }, { $project: { slug: 1, name: 1, address: 1, verifiedBadge: 1 } }],
      },
    },
    { $unwind: "$shop" },
    { $limit: limit },
  ]);
  return rows.map((d) => ({
    id: d._id.toString(),
    title: d.title,
    description: d.description ?? "",
    endsAt: d.endsAt.toISOString(),
    shop: {
      slug: d.shop.slug,
      name: d.shop.name,
      area: d.shop.address.area ?? "",
      city: d.shop.address.city,
      hasVerifiedBadge: Boolean(d.shop.verifiedBadge),
    },
  }));
}

export type AdminDeal = DealDTO & { shop: { id: string; name: string; slug: string } | null };

export async function listDealsForAdmin(query: Pagination & { state?: "running" | "all" }): Promise<Paginated<AdminDeal>> {
  await connectDB();
  const now = new Date();
  const filter = query.state === "running" ? running(now) : {};
  const [rows, total] = await Promise.all([
    Deal.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skipFor(query)).limit(query.limit).lean(),
    Deal.countDocuments(filter),
  ]);
  const shops = await Shop.find({ _id: { $in: rows.map((r) => r.shopId) } }, { name: 1, slug: 1 }).lean();
  const byId = new Map(shops.map((s) => [s._id.toString(), s]));
  return paginated(
    rows.map((d) => {
      const s = byId.get(d.shopId.toString());
      return { ...toDTO(d as unknown as DealLean, now), shop: s ? { id: s._id.toString(), name: s.name, slug: s.slug } : null };
    }),
    total,
    query,
  );
}

/** Take down any deal (e.g. misleading). The reason is shown to the shopkeeper. */
export async function removeDealAsAdmin(admin: SessionUser, dealId: string, reason: string): Promise<void> {
  await connectDB();
  const d = await Deal.findOneAndUpdate(
    { _id: dealId, removedAt: null },
    { $set: { removedAt: new Date(), removedBy: "admin", removedReason: reason } },
  ).lean();
  if (!d) throw ApiError.conflict("This deal was already removed");
  await logAdminAction(admin, "ads.deal.removed", "shop", d.shopId, `"${d.title}": ${reason}`);
  await refreshShopDeal(d.shopId);
}

/**
 * The shopkeeper's delete button: ends a running deal now, or deletes an
 * ended/removed one from their list.
 */
export async function removeMyDeal(shop: MyShop, dealId: string): Promise<"ended" | "deleted"> {
  await connectDB();
  const shopId = new Types.ObjectId(shop.id);
  const now = new Date();
  const d = await Deal.findOne({ _id: dealId, shopId }, { removedAt: 1, endsAt: 1 }).lean();
  if (!d) throw ApiError.notFound("No deal with that id");
  if (!d.removedAt && d.endsAt > now) {
    await endMyDeal(shop, dealId);
    return "ended";
  }
  await Deal.deleteOne({ _id: d._id, shopId });
  return "deleted";
}

/**
 * Admin: a running deal is taken down (reason required, shown to the shop);
 * an ended or removed one is deleted permanently. Both audited.
 */
export async function adminRemoveOrDeleteDeal(admin: SessionUser, dealId: string, reason: string | undefined): Promise<"removed" | "deleted"> {
  await connectDB();
  if (!Types.ObjectId.isValid(dealId)) throw ApiError.notFound("Deal not found");
  const d = await Deal.findById(dealId, { removedAt: 1, endsAt: 1, shopId: 1, title: 1 }).lean();
  if (!d) throw ApiError.notFound("Deal not found");
  if (!d.removedAt && d.endsAt > new Date()) {
    if (!reason) throw ApiError.badRequest("Give a reason", { fieldErrors: { reason: ["Give a reason"] } });
    await removeDealAsAdmin(admin, dealId, reason);
    return "removed";
  }
  await Deal.deleteOne({ _id: d._id });
  await logAdminAction(admin, "ads.deal.deleted", "shop", d.shopId, `"${d.title}"`);
  return "deleted";
}
