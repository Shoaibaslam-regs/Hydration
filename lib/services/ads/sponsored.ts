import "server-only";
import { Types } from "mongoose";
import { SPONSORED_SLOTS, type CampaignStatus } from "@/lib/ads/constants";
import { dayKey, endOfDayInZone, startOfDayInZone } from "@/lib/ads/dates";
import { ApiError } from "@/lib/api/errors";
import type { SessionUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { Shop, SponsoredCampaign } from "@/lib/db/models";
import { paginated, skipFor, type Paginated, type Pagination } from "@/lib/validation/pagination";
import type { CampaignRequest } from "@/lib/validation/ads";
import type { ShopSearch } from "@/lib/validation/shops";
import { logAdminAction } from "../admin/audit";
import type { MyShop } from "../my-shop";
import { buildSponsoredPipeline } from "../shop-search";
import { toShopSummary, type ShopRow, type ShopSummary } from "../shops";

export type CampaignDTO = {
  id: string;
  shopId: string;
  shopName: string;
  startsAt: string;
  endsAt: string;
  status: CampaignStatus;
  /** Approved and within its dates right now. */
  running: boolean;
  note: string;
  reviewReason: string;
  createdAt: string;
};

type CampaignLean = {
  _id: Types.ObjectId;
  shopId: Types.ObjectId;
  startsAt: Date;
  endsAt: Date;
  status: string;
  note?: string | null;
  reviewReason?: string | null;
  createdAt: Date;
};

function toDTO(c: CampaignLean, shopName: string, now: Date): CampaignDTO {
  return {
    id: c._id.toString(),
    shopId: c.shopId.toString(),
    shopName,
    startsAt: c.startsAt.toISOString(),
    endsAt: c.endsAt.toISOString(),
    status: c.status as CampaignStatus,
    running: c.status === "approved" && c.startsAt <= now && c.endsAt > now,
    note: c.note ?? "",
    reviewReason: c.reviewReason ?? "",
    createdAt: c.createdAt.toISOString(),
  };
}

const runningNow = (now: Date) => ({ status: "approved" as const, startsAt: { $lte: now }, endsAt: { $gt: now } });

/** Ask for a sponsored campaign starting on a day (app time zone) for 1, 2 or 4 weeks. One pending request at a time. */
export async function requestCampaign(shop: MyShop, input: CampaignRequest): Promise<CampaignDTO> {
  await connectDB();
  if (shop.status !== "verified") throw ApiError.forbidden("Your shop must be approved before it can be sponsored.");
  const now = new Date();
  if (input.startDate < dayKey(now)) {
    throw ApiError.badRequest("Choose today or a later date", { fieldErrors: { startDate: ["Choose today or a later date"] } });
  }
  const shopId = new Types.ObjectId(shop.id);
  if (await SponsoredCampaign.exists({ shopId, status: "pending" })) {
    throw ApiError.conflict("You already have a request waiting for review.");
  }
  const startsAt = startOfDayInZone(input.startDate);
  const lastDay = dayKey(new Date(startsAt.getTime() + (input.weeks * 7 - 1) * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000));
  const c = await SponsoredCampaign.create({ shopId, startsAt, endsAt: endOfDayInZone(lastDay), note: input.note });
  return toDTO(c.toObject() as unknown as CampaignLean, shop.name, now);
}

export async function listMyCampaigns(shop: MyShop): Promise<CampaignDTO[]> {
  await connectDB();
  const now = new Date();
  const rows = await SponsoredCampaign.find({ shopId: new Types.ObjectId(shop.id), hiddenForShop: { $ne: true } })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
  return rows.map((c) => toDTO(c as unknown as CampaignLean, shop.name, now));
}

/** Withdraw a request that hasn't been reviewed yet. */
export async function withdrawMyCampaign(shop: MyShop, campaignId: string): Promise<void> {
  await connectDB();
  const res = await SponsoredCampaign.updateOne(
    { _id: campaignId, shopId: new Types.ObjectId(shop.id), status: "pending" },
    { $set: { status: "cancelled", reviewReason: "Withdrawn by the shop" } },
  );
  if (res.matchedCount === 0) throw ApiError.conflict("Only requests waiting for review can be withdrawn");
}

export async function listCampaignsForAdmin(query: Pagination & { status?: CampaignStatus }): Promise<Paginated<CampaignDTO>> {
  await connectDB();
  const now = new Date();
  const filter = query.status ? { status: query.status } : {};
  // Pending: oldest first (a queue). Otherwise newest campaigns first.
  const sort: Record<string, 1 | -1> = query.status === "pending" ? { createdAt: 1, _id: 1 } : { startsAt: -1, _id: 1 };
  const [rows, total] = await Promise.all([
    SponsoredCampaign.find(filter).sort(sort).skip(skipFor(query)).limit(query.limit).lean(),
    SponsoredCampaign.countDocuments(filter),
  ]);
  const shops = await Shop.find({ _id: { $in: rows.map((r) => r.shopId) } }, { name: 1 }).lean();
  const names = new Map(shops.map((s) => [s._id.toString(), s.name]));
  return paginated(rows.map((c) => toDTO(c as unknown as CampaignLean, names.get(c.shopId.toString()) ?? "Deleted shop", now)), total, query);
}

/** Approve (after payment was received), reject, or cancel an approved campaign. Each is atomic and audited. */
export async function decideCampaign(
  admin: SessionUser,
  campaignId: string,
  decision: { decision: "approve" } | { decision: "reject" | "cancel"; reason: string },
): Promise<void> {
  await connectDB();
  const from = decision.decision === "cancel" ? "approved" : "pending";
  const to = decision.decision === "approve" ? "approved" : decision.decision === "reject" ? "rejected" : "cancelled";
  const reason = decision.decision === "approve" ? "" : decision.reason;
  const c = await SponsoredCampaign.findOneAndUpdate(
    { _id: campaignId, status: from },
    { $set: { status: to, reviewedBy: new Types.ObjectId(admin.id), reviewedAt: new Date(), reviewReason: reason } },
  ).lean();
  if (!c) throw ApiError.conflict(`This campaign isn't ${from === "approved" ? "approved" : "waiting for review"} any more`);
  if (decision.decision === "approve" && c.endsAt <= new Date()) {
    await SponsoredCampaign.updateOne({ _id: c._id }, { $set: { status: "pending" } });
    throw ApiError.conflict("This campaign's dates have already passed. Reject it instead.");
  }
  const action = to === "approved" ? "ads.campaign.approved" : to === "rejected" ? "ads.campaign.rejected" : "ads.campaign.cancelled";
  await logAdminAction(admin, action, "shop", c.shopId, `${dayKey(c.startsAt)} → ${dayKey(new Date(c.endsAt.getTime() - 1))}${reason ? `: ${reason}` : ""}`);
}

/** Up to SPONSORED_SLOTS sponsored shops for a located search (see buildSponsoredPipeline). */
export async function findSponsoredShops(input: ShopSearch): Promise<ShopSummary[]> {
  await connectDB();
  const now = new Date();
  const sponsoredShopIds = await SponsoredCampaign.distinct("shopId", runningNow(now));
  const pipeline = buildSponsoredPipeline(input, {
    sponsoredShopIds: sponsoredShopIds as Types.ObjectId[],
    slots: SPONSORED_SLOTS,
    now,
  });
  if (!pipeline) return [];
  const rows = await Shop.aggregate<ShopRow>(pipeline);
  return rows.map(toShopSummary);
}

/** Whether the shop has a running approved campaign. For the shopkeeper's Promote page. */
export async function isSponsoredNow(shopId: string): Promise<boolean> {
  await connectDB();
  return Boolean(await SponsoredCampaign.exists({ shopId: new Types.ObjectId(shopId), ...runningNow(new Date()) }));
}

/** Finished = nothing left to happen: rejected, cancelled, or approved and already over. */
const finishedCampaign = (now: Date): Record<string, unknown> => ({
  $or: [{ status: { $in: ["rejected", "cancelled"] } }, { status: "approved", endsAt: { $lte: now } }],
});

/**
 * The shopkeeper's delete button: withdraws a request that's still waiting
 * for review, or removes a finished one from their history (admins keep the
 * record). Running or upcoming approved campaigns can't be deleted.
 */
export async function removeMyCampaign(shop: MyShop, campaignId: string): Promise<"withdrawn" | "removed"> {
  await connectDB();
  const shopId = new Types.ObjectId(shop.id);
  const c = await SponsoredCampaign.findOne({ _id: campaignId, shopId, hiddenForShop: { $ne: true } }, { status: 1 }).lean();
  if (!c) throw ApiError.notFound("Campaign not found");
  if (c.status === "pending") {
    await withdrawMyCampaign(shop, campaignId);
    return "withdrawn";
  }
  const filter: Record<string, unknown> = { _id: campaignId, shopId, ...finishedCampaign(new Date()) };
  const res = await SponsoredCampaign.updateOne(filter, { $set: { hiddenForShop: true } });
  if (res.matchedCount === 0) throw ApiError.conflict("This campaign is approved and hasn't finished yet, so it can't be deleted.");
  return "removed";
}

/** Permanently delete a finished campaign record. Audited. */
export async function deleteCampaignAsAdmin(admin: SessionUser, campaignId: string): Promise<void> {
  await connectDB();
  if (!Types.ObjectId.isValid(campaignId)) throw ApiError.notFound("Campaign not found");
  const filter: Record<string, unknown> = { _id: campaignId, ...finishedCampaign(new Date()) };
  const c = (await SponsoredCampaign.findOneAndDelete(filter).lean()) as { shopId: Types.ObjectId; startsAt: Date; endsAt: Date; status: string } | null;
  if (!c) {
    if (!(await SponsoredCampaign.exists({ _id: campaignId }))) throw ApiError.notFound("Campaign not found");
    throw ApiError.conflict("Only finished campaigns can be deleted. Reject or cancel it first.");
  }
  await logAdminAction(admin, "ads.campaign.deleted", "shop", c.shopId, `${dayKey(c.startsAt)} → ${dayKey(new Date(c.endsAt.getTime() - 1))} (${c.status})`);
}
