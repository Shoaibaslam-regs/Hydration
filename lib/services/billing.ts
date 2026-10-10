import "server-only";
import { revalidateTag } from "next/cache";
import { Types } from "mongoose";
import { ApiError } from "@/lib/api/errors";
import { addMonths, nextPeriodStart, type PaymentMethod, type SubscriptionPaymentStatus } from "@/lib/billing/constants";
import type { SessionUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { Shop, SubscriptionPayment } from "@/lib/db/models";
import { PLANS, planName, TRIAL_DAYS, TRIAL_PLAN_ID } from "@/lib/plans";
import { paginated, skipFor, type Paginated, type Pagination } from "@/lib/validation/pagination";
import type { PaymentSubmitInput } from "@/lib/validation/billing";
import { logAdminAction } from "./admin/audit";
import type { MyShop } from "./my-shop";
import { shopTag } from "./shops";

export type PaymentDTO = {
  id: string;
  shopId: string;
  shopName: string;
  planId: string;
  planName: string;
  months: number;
  amount: number;
  method: PaymentMethod;
  reference: string;
  note: string;
  status: SubscriptionPaymentStatus;
  reviewReason: string;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type ShopSubscription = { planId: string; planName: string; isTrial: boolean; endsAt: string; active: boolean } | null;

const DUPLICATE_KEY = 11000;

type PaymentLean = {
  _id: Types.ObjectId;
  shopId: Types.ObjectId;
  planId: string;
  months: number;
  amount: number;
  method: string;
  reference: string;
  note?: string | null;
  status: string;
  reviewReason?: string | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  createdAt: Date;
  reviewedAt?: Date | null;
};

function toDTO(p: PaymentLean, shopName: string): PaymentDTO {
  return {
    id: p._id.toString(),
    shopId: p.shopId.toString(),
    shopName,
    planId: p.planId,
    planName: planName(p.planId),
    months: p.months,
    amount: p.amount,
    method: p.method as PaymentMethod,
    reference: p.reference,
    note: p.note ?? "",
    status: p.status as SubscriptionPaymentStatus,
    reviewReason: p.reviewReason ?? "",
    periodStart: p.periodStart ? p.periodStart.toISOString() : null,
    periodEnd: p.periodEnd ? p.periodEnd.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    reviewedAt: p.reviewedAt ? p.reviewedAt.toISOString() : null,
  };
}

export function toShopSubscription(sub: { planId?: string | null; endsAt?: Date | null } | null | undefined, now: Date): ShopSubscription {
  if (!sub?.planId || !sub.endsAt) return null;
  return {
    planId: sub.planId,
    planName: planName(sub.planId),
    isTrial: sub.planId === TRIAL_PLAN_ID,
    endsAt: sub.endsAt.toISOString(),
    active: sub.endsAt > now,
  };
}

/**
 * Give a shop its free trial (TRIAL_DAYS from `now`), once per shop: called
 * when an admin first approves it. Does nothing if the trial was already used
 * or a paid plan is running. Returns whether the trial started.
 */
export async function startTrial(shopId: Types.ObjectId | string, now = new Date()): Promise<boolean> {
  const res = await Shop.updateOne(
    {
      _id: shopId,
      trialStartedAt: null,
      $or: [{ subscription: null }, { "subscription.endsAt": { $lte: now } }],
    },
    {
      $set: {
        trialStartedAt: now,
        subscription: { planId: TRIAL_PLAN_ID, endsAt: new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000) },
      },
    },
  );
  return res.modifiedCount > 0;
}

/** The shop's plan and recent payments, for its billing page. */
export async function getMyBilling(shop: MyShop): Promise<{ subscription: ShopSubscription; payments: PaymentDTO[] }> {
  await connectDB();
  const id = new Types.ObjectId(shop.id);
  const [doc, payments] = await Promise.all([
    Shop.findById(id, { subscription: 1 }).lean(),
    SubscriptionPayment.find({ shopId: id }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);
  return {
    subscription: toShopSubscription(doc?.subscription, new Date()),
    payments: payments.map((p) => toDTO(p as unknown as PaymentLean, shop.name)),
  };
}

/** Record a payment the shopkeeper made outside the site, for an admin to review. One pending at a time. */
export async function submitSubscriptionPayment(shop: MyShop, ownerId: string, input: PaymentSubmitInput): Promise<PaymentDTO> {
  await connectDB();
  const plan = PLANS.find((p) => p.id === input.planId);
  if (!plan) throw ApiError.badRequest("Unknown plan");
  if (shop.status === "suspended") throw ApiError.forbidden("This shop is suspended. Contact support.");
  try {
    const p = await SubscriptionPayment.create({
      shopId: shop.id,
      ownerId,
      planId: plan.id,
      months: input.months,
      amount: plan.monthlyPrice * input.months, // never trust an amount from the client
      method: input.method,
      reference: input.reference,
      note: input.note,
    });
    return toDTO(p.toObject() as unknown as PaymentLean, shop.name);
  } catch (err) {
    if ((err as { code?: number }).code === DUPLICATE_KEY) {
      throw ApiError.conflict("You already have a payment waiting for review. We'll check it soon.");
    }
    throw err;
  }
}

export async function listSubscriptionPayments(
  query: Pagination & { status?: SubscriptionPaymentStatus },
): Promise<Paginated<PaymentDTO>> {
  await connectDB();
  const filter: Record<string, unknown> = query.status ? { status: query.status } : {};
  // Oldest pending first (a queue); otherwise newest first.
  const sort = query.status === "pending" ? { createdAt: 1 as const } : { createdAt: -1 as const };
  const [rows, total] = await Promise.all([
    SubscriptionPayment.find(filter).sort({ ...sort, _id: 1 }).skip(skipFor(query)).limit(query.limit).lean(),
    SubscriptionPayment.countDocuments(filter),
  ]);
  const shops = await Shop.find({ _id: { $in: rows.map((r) => r.shopId) } }, { name: 1 }).lean();
  const names = new Map(shops.map((s) => [s._id.toString(), s.name]));
  return paginated(
    rows.map((r) => toDTO(r as unknown as PaymentLean, names.get(r.shopId.toString()) ?? "Deleted shop")),
    total,
    query,
  );
}

/**
 * Approve a payment: claim it atomically (two admins can't both approve it),
 * then extend the shop's plan. Renewals stack after the current period.
 */
export async function approveSubscriptionPayment(admin: SessionUser, paymentId: string): Promise<PaymentDTO> {
  await connectDB();
  const pending = await SubscriptionPayment.findOne({ _id: paymentId, status: "pending" }, { shopId: 1 }).lean();
  if (!pending) throw ApiError.conflict("This payment isn't waiting for review any more");
  const shop = await Shop.findById(pending.shopId, { name: 1, slug: 1, subscription: 1 }).lean();
  if (!shop) throw ApiError.conflict("This shop no longer exists. Reject the payment instead.");

  const now = new Date();
  const claimed = await SubscriptionPayment.findOneAndUpdate(
    { _id: paymentId, status: "pending" },
    { $set: { status: "approved", reviewedBy: new Types.ObjectId(admin.id), reviewedAt: now } },
    { new: true },
  ).lean();
  if (!claimed) throw ApiError.conflict("This payment was just reviewed by someone else");

  const periodStart = nextPeriodStart(shop.subscription?.endsAt, now);
  const periodEnd = addMonths(periodStart, claimed.months);
  await Promise.all([
    SubscriptionPayment.updateOne({ _id: claimed._id }, { $set: { periodStart, periodEnd } }),
    Shop.updateOne({ _id: shop._id }, { $set: { subscription: { planId: claimed.planId, endsAt: periodEnd } } }),
  ]);
  await logAdminAction(admin, "subscription.approved", "shop", shop._id, `${planName(claimed.planId)} × ${claimed.months} mo (${claimed.reference})`);
  revalidateTag(shopTag(shop.slug), { expire: 0 });
  return toDTO({ ...(claimed as unknown as PaymentLean), periodStart, periodEnd }, shop.name);
}

export async function rejectSubscriptionPayment(admin: SessionUser, paymentId: string, reason: string): Promise<void> {
  await connectDB();
  const claimed = await SubscriptionPayment.findOneAndUpdate(
    { _id: paymentId, status: "pending" },
    { $set: { status: "rejected", reviewedBy: new Types.ObjectId(admin.id), reviewedAt: new Date(), reviewReason: reason } },
  ).lean();
  if (!claimed) throw ApiError.conflict("This payment isn't waiting for review any more");
  await logAdminAction(admin, "subscription.rejected", "shop", claimed.shopId, `${claimed.reference}: ${reason}`);
}

/** Approved, open shops hidden from search because their trial or plan has ended. */
export async function countShopsWithoutActivePlan(): Promise<number> {
  await connectDB();
  return Shop.countDocuments({
    status: "verified",
    closure: null,
    $or: [{ subscription: null }, { "subscription.endsAt": { $lte: new Date() } }],
  });
}
