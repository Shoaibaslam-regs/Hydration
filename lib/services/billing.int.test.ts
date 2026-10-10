import { describe, expect, it } from "vitest";
import { AdminAction, Shop, SubscriptionPayment } from "@/lib/db/models";
import { shopSearchSchema } from "@/lib/validation/shops";
import { createShop, createUser, HOME, placeTestOrder } from "@/test/fixtures";
import { setupTestDb } from "@/test/db";
import { PLANS } from "@/lib/plans";
import { adminRemoveShop } from "./admin/shops";
import { getRevenueAnalytics } from "./analytics";
import { approveSubscriptionPayment, countShopsWithoutActivePlan, getMyBilling, rejectSubscriptionPayment, startTrial, submitSubscriptionPayment } from "./billing";
import { searchShops } from "./shops";

setupTestDb();

const MONTHLY = PLANS[0].monthlyPrice;
const pay = { planId: "monthly" as const, months: 3 as const, method: "jazzcash" as const, reference: "TXN-1001", note: "" };

async function setup() {
  const owner = await createUser("shopkeeper");
  const shop = await createShop(owner, { planEndsAt: null });
  const admin = await createUser("admin", "Admin");
  return { owner, shop, admin };
}

describe("submitting a plan payment", () => {
  it("prices it on the server and allows one pending payment at a time", async () => {
    const { owner, shop } = await setup();
    const p = await submitSubscriptionPayment(shop, owner.id, pay);
    expect(p).toMatchObject({ status: "pending", amount: MONTHLY * 3, planName: "Monthly" });
    await expect(submitSubscriptionPayment(shop, owner.id, { ...pay, reference: "TXN-1002" })).rejects.toMatchObject({ status: 409 });
  });

  it("refuses suspended shops", async () => {
    const { owner, shop } = await setup();
    await expect(submitSubscriptionPayment({ ...shop, status: "suspended" }, owner.id, pay)).rejects.toMatchObject({ status: 403 });
  });
});

describe("reviewing plan payments", () => {
  it("activates the plan now, stacks renewals after the current period, and audits", async () => {
    const { owner, shop, admin } = await setup();
    const first = await submitSubscriptionPayment(shop, owner.id, { ...pay, months: 1 });
    const approved = await approveSubscriptionPayment(admin, first.id);
    const firstEnd = new Date(approved.periodEnd!);
    expect(Math.abs(new Date(approved.periodStart!).getTime() - Date.now())).toBeLessThan(5_000);
    expect((await getMyBilling(shop)).subscription).toMatchObject({ planId: "monthly", isTrial: false, active: true });

    const renewal = await submitSubscriptionPayment(shop, owner.id, { ...pay, months: 3, reference: "TXN-2" });
    const renewed = await approveSubscriptionPayment(admin, renewal.id);
    expect(renewed.periodStart).toBe(firstEnd.toISOString());
    expect((await Shop.findById(shop.id).lean())!.subscription).toMatchObject({ planId: "monthly", endsAt: new Date(renewed.periodEnd!) });
    expect(await AdminAction.countDocuments({ action: "subscription.approved", targetId: shop.id })).toBe(2);
  });

  it("lets exactly one of two concurrent approvals win", async () => {
    const { owner, shop, admin } = await setup();
    const p = await submitSubscriptionPayment(shop, owner.id, pay);
    const results = await Promise.allSettled([approveSubscriptionPayment(admin, p.id), approveSubscriptionPayment(admin, p.id)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await AdminAction.countDocuments({ action: "subscription.approved" })).toBe(1);
  });

  it("rejects with a reason the shopkeeper sees, then allows a new payment", async () => {
    const { owner, shop, admin } = await setup();
    const p = await submitSubscriptionPayment(shop, owner.id, pay);
    await rejectSubscriptionPayment(admin, p.id, "No payment with this reference");
    await expect(approveSubscriptionPayment(admin, p.id)).rejects.toMatchObject({ status: 409 });
    expect((await getMyBilling(shop)).payments[0]).toMatchObject({ status: "rejected", reviewReason: "No payment with this reference" });
    await expect(submitSubscriptionPayment(shop, owner.id, { ...pay, reference: "TXN-NEW" })).resolves.toMatchObject({ status: "pending" });
  });

  it("won't approve a payment for a shop that was removed", async () => {
    const { owner, shop, admin } = await setup();
    const p = await submitSubscriptionPayment(shop, owner.id, pay);
    await adminRemoveShop(admin, shop.id, "Duplicate");
    await expect(approveSubscriptionPayment(admin, p.id)).rejects.toMatchObject({ status: 409 });
    expect(await SubscriptionPayment.findById(p.id).lean()).toMatchObject({ status: "pending" });
  });
});

describe("free trial and plan enforcement", () => {
  it("lists the shop during the trial, hides it and blocks orders after, and a payment brings it back", async () => {
    const { owner, shop, admin } = await setup();
    const listed = async () => (await searchShops(shopSearchSchema.parse({ lat: HOME.lat, lng: HOME.lng }))).total;

    // No plan at all (never approved through the admin flow): hidden.
    expect(await listed()).toBe(0);
    expect(await startTrial(shop.id)).toBe(true);
    expect(await startTrial(shop.id)).toBe(false); // only once
    expect(await listed()).toBe(1);
    expect((await getMyBilling(shop)).subscription).toMatchObject({ planName: "Free trial", isTrial: true, active: true });
    await placeTestOrder(shop);

    // Trial over.
    await Shop.updateOne({ _id: shop.id }, { "subscription.endsAt": new Date(Date.now() - 1000) });
    expect(await listed()).toBe(0);
    expect(await countShopsWithoutActivePlan()).toBe(1);
    await expect(placeTestOrder(shop)).rejects.toMatchObject({ status: 409, message: expect.stringContaining("isn't taking orders") });
    expect(await startTrial(shop.id)).toBe(false);

    const p = await submitSubscriptionPayment(shop, owner.id, { ...pay, months: 1 });
    await approveSubscriptionPayment(admin, p.id);
    expect(await listed()).toBe(1);
    expect(await countShopsWithoutActivePlan()).toBe(0);
  });

  it("adds paid months after the trial when paying during it", async () => {
    const { owner, shop, admin } = await setup();
    await startTrial(shop.id);
    const trialEnd = (await Shop.findById(shop.id).lean())!.subscription!.endsAt;
    const p = await submitSubscriptionPayment(shop, owner.id, { ...pay, months: 1 });
    const approved = await approveSubscriptionPayment(admin, p.id);
    expect(approved.periodStart).toBe(trialEnd.toISOString());
  });
});

describe("platform revenue", () => {
  it("counts approved plan payments in the window", async () => {
    const { owner, shop, admin } = await setup();
    const p = await submitSubscriptionPayment(shop, owner.id, pay);
    await approveSubscriptionPayment(admin, p.id);
    const other = await setup();
    const rejected = await submitSubscriptionPayment(other.shop, other.owner.id, pay);
    await rejectSubscriptionPayment(admin, rejected.id, "Unknown reference");
    const a = await getRevenueAnalytics(30);
    expect(a.totals).toMatchObject({ subscriptionRevenue: MONTHLY * 3, approvedPayments: 1 });
  });
});
