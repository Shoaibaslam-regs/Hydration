import { describe, expect, it } from "vitest";
import { dayKey } from "@/lib/ads/dates";
import { hashPassword } from "@/lib/auth/password";
import { AdminAction, Deal, Order, Review, Shop, SponsoredCampaign, SubscriptionPayment, SupportThread, User } from "@/lib/db/models";
import { createShop, createUser, placeTestOrder } from "@/test/fixtures";
import { setupTestDb } from "@/test/db";
import { getSalesAnalytics } from "./analytics";
import { clearAdminActions, deleteAdminAction, listAdminActions, logAdminAction } from "./admin/audit";
import { deleteOrderAsAdmin } from "./admin/orders";
import { deleteMyAccount } from "./admin/user-removal";
import { adminRemoveOrDeleteDeal, createMyDeal, removeMyDeal } from "./ads/deals";
import { decideCampaign, deleteCampaignAsAdmin, listMyCampaigns, removeMyCampaign, requestCampaign } from "./ads/sponsored";
import { approveSubscriptionPayment, deleteMyPayment, deletePaymentAsAdmin, rejectSubscriptionPayment, submitSubscriptionPayment } from "./billing";
import { clearCustomerOrderHistory, getCustomerOrder, hideCustomerOrder, listCustomerOrders } from "./customer-orders";
import { createReview, deleteMyReview, deleteReviewAsAdmin } from "./reviews";
import { clearShopOrderHistory, hideShopOrder, listShopOrders, updateShopOrderStatus } from "./shop-orders";
import { createSupportThread, deleteSupportThread, getSupportThreadForAdmin, hideMySupportThread, listMySupportThreads, replyAsAdmin } from "./support";

setupTestDb();

const deliver = async (shop: Parameters<typeof updateShopOrderStatus>[0], id: string) => {
  for (const status of ["confirmed", "out_for_delivery", "delivered"] as const) await updateShopOrderStatus(shop, id, { status });
};
const page = { page: 1, limit: 50 };

describe("order history", () => {
  it("customers and shops hide finished orders from their own lists only", async () => {
    const shop = await createShop(await createUser("shopkeeper"));
    const { id: done, customer } = await placeTestOrder(shop, 2);
    await deliver(shop, done);
    const { id: open } = await placeTestOrder(shop, 1, customer);

    await expect(hideCustomerOrder(customer.id, open)).rejects.toMatchObject({ status: 409 });
    await hideCustomerOrder(customer.id, done);
    expect((await listCustomerOrders(customer.id, page)).items.map((o) => o.id)).toEqual([open]);
    expect(await getCustomerOrder(customer.id, done)).toBeNull();
    // The shop still sees it, and it still counts in sales.
    expect((await listShopOrders(shop, page)).total).toBe(2);
    expect((await getSalesAnalytics(30, shop.id)).totals).toMatchObject({ delivered: 1 });

    await expect(hideShopOrder(shop, open)).rejects.toMatchObject({ status: 409 });
    expect(await clearShopOrderHistory(shop)).toBe(1);
    expect((await listShopOrders(shop, page)).items.map((o) => o.id)).toEqual([open]);
    expect((await getSalesAnalytics(30, shop.id)).totals).toMatchObject({ delivered: 1 });

    const other = await createUser("customer");
    await expect(hideCustomerOrder(other.id, open)).rejects.toMatchObject({ status: 404 });
    await updateShopOrderStatus(shop, open, { status: "rejected", note: "Out today" });
    expect(await clearCustomerOrderHistory(customer.id)).toBe(1);
    expect((await listCustomerOrders(customer.id, page)).total).toBe(0);
  });

  it("admins delete finished orders permanently, with their review", async () => {
    const admin = await createUser("admin");
    const shop = await createShop(await createUser("shopkeeper"));
    const { id, customer } = await placeTestOrder(shop);
    await expect(deleteOrderAsAdmin(admin, id)).rejects.toMatchObject({ status: 409 });
    await deliver(shop, id);
    await createReview(customer, id, { rating: 5, comment: "" });
    await deleteOrderAsAdmin(admin, id);
    expect(await Order.exists({ _id: id })).toBeNull();
    expect(await Review.countDocuments()).toBe(0);
    expect((await Shop.findById(shop.id).lean())!.rating).toMatchObject({ count: 0 });
    expect(await AdminAction.countDocuments({ action: "order.deleted" })).toBe(1);
  });
});

describe("reviews", () => {
  it("customers delete their own; admins delete any with a reason", async () => {
    const admin = await createUser("admin");
    const shop = await createShop(await createUser("shopkeeper"));
    const { id, customer } = await placeTestOrder(shop);
    await deliver(shop, id);
    await createReview(customer, id, { rating: 4, comment: "Good" });
    await expect(deleteMyReview(await createUser("customer"), id)).rejects.toMatchObject({ status: 404 });
    await deleteMyReview(customer, id);
    expect((await Shop.findById(shop.id).lean())!.rating).toMatchObject({ count: 0 });

    await createReview(customer, id, { rating: 1, comment: "Spam spam" });
    const review = (await Review.findOne({}).lean())!;
    await deleteReviewAsAdmin(admin, review._id.toString(), "Spam");
    expect(await Review.countDocuments()).toBe(0);
    expect(await AdminAction.findOne({ action: "review.deleted" }).lean()).toMatchObject({ targetType: "shop" });
  });
});

describe("ads history", () => {
  it("shops withdraw pending and hide finished campaigns; running ones stay; admins delete finished", async () => {
    const admin = await createUser("admin");
    const shop = await createShop(await createUser("shopkeeper"));
    const today = dayKey(new Date());

    const pending = await requestCampaign(shop, { startDate: today, weeks: 1, note: "" });
    expect(await removeMyCampaign(shop, pending.id)).toBe("withdrawn");
    expect(await removeMyCampaign(shop, pending.id)).toBe("removed"); // now cancelled → hidden
    expect(await listMyCampaigns(shop)).toEqual([]);
    expect(await SponsoredCampaign.exists({ _id: pending.id })).not.toBeNull(); // admin still has it

    const running = await requestCampaign(shop, { startDate: today, weeks: 1, note: "" });
    await decideCampaign(admin, running.id, { decision: "approve" });
    await expect(removeMyCampaign(shop, running.id)).rejects.toMatchObject({ status: 409 });
    await expect(deleteCampaignAsAdmin(admin, running.id)).rejects.toMatchObject({ status: 409 });
    await deleteCampaignAsAdmin(admin, pending.id);
    expect(await SponsoredCampaign.exists({ _id: pending.id })).toBeNull();
  });

  it("deals: running ones end first, then can be deleted; admins need a reason only for running ones", async () => {
    const admin = await createUser("admin");
    const shop = await createShop(await createUser("shopkeeper"));
    const d = await createMyDeal(shop, { title: "Cheap cans", description: "", days: 3 });
    expect(await removeMyDeal(shop, d.id)).toBe("ended");
    expect(await removeMyDeal(shop, d.id)).toBe("deleted");
    expect(await Deal.countDocuments()).toBe(0);

    const d2 = await createMyDeal(shop, { title: "Another", description: "", days: 3 });
    await expect(adminRemoveOrDeleteDeal(admin, d2.id, undefined)).rejects.toMatchObject({ status: 400 });
    expect(await adminRemoveOrDeleteDeal(admin, d2.id, "Misleading")).toBe("removed");
    expect(await adminRemoveOrDeleteDeal(admin, d2.id, undefined)).toBe("deleted");
    await expect(removeMyDeal(await createShop(await createUser("shopkeeper")), d.id)).rejects.toMatchObject({ status: 404 });
  });
});

describe("plan payments", () => {
  it("pending and rejected can be deleted; approved never", async () => {
    const admin = await createUser("admin");
    const owner = await createUser("shopkeeper");
    const shop = await createShop(owner, { planEndsAt: null });
    const pay = { planId: "monthly" as const, months: 1 as const, method: "jazzcash" as const, reference: "TX-1", note: "" };

    const p1 = await submitSubscriptionPayment(shop, owner.id, pay);
    await deleteMyPayment(shop, p1.id); // cancel a pending one
    const p2 = await submitSubscriptionPayment(shop, owner.id, { ...pay, reference: "TX-2" });
    await rejectSubscriptionPayment(admin, p2.id, "Unknown ref");
    await deletePaymentAsAdmin(admin, p2.id);
    const p3 = await submitSubscriptionPayment(shop, owner.id, { ...pay, reference: "TX-3" });
    await approveSubscriptionPayment(admin, p3.id);
    await expect(deleteMyPayment(shop, p3.id)).rejects.toMatchObject({ status: 409 });
    await expect(deletePaymentAsAdmin(admin, p3.id)).rejects.toMatchObject({ status: 409 });
    expect(await SubscriptionPayment.countDocuments()).toBe(1);
  });
});

describe("support and admin history", () => {
  it("shopkeepers hide conversations (a new reply brings them back); admins delete for everyone", async () => {
    const admin = await createUser("admin");
    const owner = await createUser("shopkeeper");
    const id = await createSupportThread(owner, { category: "other", subject: "Hello there", body: "Hi" });
    await hideMySupportThread(owner.id, id);
    expect(await listMySupportThreads(owner.id)).toEqual([]);
    await replyAsAdmin(admin, id, "Still need help?");
    expect((await listMySupportThreads(owner.id)).map((t) => t.id)).toEqual([id]);
    await deleteSupportThread(admin, id);
    expect(await getSupportThreadForAdmin(id)).toBeNull();
    expect(await SupportThread.countDocuments()).toBe(0);
  });

  it("deletes single entries and clears a page's history, leaving one note", async () => {
    const admin = await createUser("admin", "Admin");
    const shop = await createShop(await createUser("shopkeeper"));
    for (const action of ["shop.verified", "shop.closed", "shop.reopened"]) await logAdminAction(admin, action, "shop", shop.id);
    const [first] = await listAdminActions("shop", shop.id);
    await deleteAdminAction(first.id);
    expect(await listAdminActions("shop", shop.id)).toHaveLength(2);
    expect(await clearAdminActions(admin, "shop", shop.id)).toBe(2);
    expect((await listAdminActions("shop", shop.id)).map((e) => [e.action, e.reason])).toEqual([["history.cleared", "2 entries"]]);
  });
});

describe("deleting your own account", () => {
  it("needs the right password and isn't available to admins", async () => {
    const owner = await createUser("shopkeeper");
    await User.updateOne({ _id: owner.id }, { passwordHash: await hashPassword("secret123") });
    const shop = await createShop(owner);
    await placeTestOrder(shop);
    await expect(deleteMyAccount(owner, "wrong")).rejects.toMatchObject({ status: 400 });
    expect(await deleteMyAccount(owner, "secret123")).toMatchObject({ role: "shopkeeper", removedShop: true, cancelledOrders: 1 });
    expect(await User.exists({ _id: owner.id })).toBeNull();
    expect(await Shop.exists({ _id: shop.id })).toBeNull();
    await expect(deleteMyAccount(await createUser("admin"), "x")).rejects.toMatchObject({ status: 403 });
  });
});
