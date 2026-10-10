import { describe, expect, it } from "vitest";
import { Address, AdminAction, Order, Product, Review, Shop, User } from "@/lib/db/models";
import { createAddress, createProduct, createShop, createUser, stockOf } from "@/test/fixtures";
import { setupTestDb } from "@/test/db";
import { deleteUserAccount } from "./admin/user-removal";
import { getAdminUser, listAdminUsers, updateAdminUser } from "./admin/users";
import { placeOrder } from "./customer-orders";
import { createReview } from "./reviews";
import { updateShopOrderStatus } from "./shop-orders";
import { authenticate, registerUser } from "./users";

setupTestDb();

describe("timed suspension", () => {
  it("blocks login until it ends, then unlocks by itself", async () => {
    const admin = await createUser("admin", "Admin");
    const user = await registerUser({ name: "Sara", email: "sara@t.test", password: "secret123", role: "customer" });
    await updateAdminUser(admin, user.id, { action: "suspend", reason: "Abuse", days: 7 });

    const detail = await getAdminUser(user.id);
    expect(detail).toMatchObject({ status: "suspended" });
    const days = (new Date(detail!.suspendedUntil!).getTime() - Date.now()) / 864e5;
    expect(days).toBeGreaterThan(6.99);
    expect(days).toBeLessThanOrEqual(7);
    await expect(authenticate({ email: "sara@t.test", password: "secret123" })).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining("suspended until"),
    });
    expect((await listAdminUsers({ page: 1, limit: 20, status: "suspended" })).total).toBe(1);
    await expect(updateAdminUser(admin, user.id, { action: "suspend", reason: "again", days: 1 })).rejects.toMatchObject({ status: 409 });

    // Time passes: the suspension has ended.
    await User.updateOne({ _id: user.id }, { suspendedUntil: new Date(Date.now() - 1000) });
    expect(await getAdminUser(user.id)).toMatchObject({ status: "active", suspendedUntil: null });
    expect((await listAdminUsers({ page: 1, limit: 20, status: "suspended" })).total).toBe(0);
    expect((await listAdminUsers({ page: 1, limit: 20, status: "active" })).items.map((u) => u.id)).toContain(user.id);
    await expect(authenticate({ email: "sara@t.test", password: "secret123" })).resolves.toMatchObject({ id: user.id });
    expect(await User.findById(user.id).lean()).toMatchObject({ status: "active", suspendedUntil: null });
  });

  it("supports indefinite suspension lifted by an admin", async () => {
    const admin = await createUser("admin", "Admin");
    const user = await createUser("customer");
    await updateAdminUser(admin, user.id, { action: "suspend", reason: "Fraud", days: null });
    expect(await getAdminUser(user.id)).toMatchObject({ status: "suspended", suspendedUntil: null });
    await updateAdminUser(admin, user.id, { action: "activate" });
    expect(await getAdminUser(user.id)).toMatchObject({ status: "active" });
  });
});

describe("deleting a user", () => {
  it("customer: cancels open orders, anonymizes past ones, removes reviews and personal data", async () => {
    const admin = await createUser("admin", "Admin");
    const owner = await createUser("shopkeeper");
    const shop = await createShop(owner);
    const can = await createProduct(shop, { stock: 10 });
    const customer = await registerUser({ name: "Sara Khan", email: "sara@t.test", password: "secret123", role: "customer" });
    const session = { id: customer.id, name: customer.name, email: customer.email, role: "customer" as const };
    const addressId = await createAddress(session);
    const order = (q: number) =>
      placeOrder(session, { shopSlug: shop.slug, items: [{ productId: can, quantity: q }], addressId, contactPhone: "+92 301 0000000", notes: "" });

    const { id: past } = await order(2);
    for (const status of ["confirmed", "out_for_delivery", "delivered"] as const) await updateShopOrderStatus(shop, past, { status });
    await createReview(session, past, { rating: 5, comment: "Great" });
    const { id: open } = await order(3);
    expect(await stockOf(can)).toBe(5);

    await expect(deleteUserAccount(admin, customer.id, "wrong@t.test", "Asked to be forgotten")).rejects.toMatchObject({ status: 400 });
    await expect(deleteUserAccount(admin, admin.id, admin.email, "x")).rejects.toMatchObject({ status: 403 });

    const result = await deleteUserAccount(admin, customer.id, "SARA@t.test", "Asked to be forgotten");
    expect(result).toMatchObject({ role: "customer", cancelledOrders: 1, anonymizedOrders: 2, deletedReviews: 1, removedShop: false });

    expect(await User.exists({ _id: customer.id })).toBeNull();
    expect(await Address.countDocuments({ userId: customer.id })).toBe(0);
    expect(await Review.countDocuments({ customerId: customer.id })).toBe(0);
    expect(await stockOf(can)).toBe(8); // the 3 from the open order came back
    expect((await Shop.findById(shop.id).lean())!.rating).toMatchObject({ average: 0, count: 0 });

    const kept = await Order.findById(past).lean();
    expect(kept).toMatchObject({ status: "delivered", total: 55_000, contactName: "Deleted customer", contactPhone: "—" });
    expect(kept!.deliveryAddress).toMatchObject({ line1: "Removed", city: "Lahore" });
    expect(await Order.findById(open).lean()).toMatchObject({ status: "cancelled" });

    const log = await AdminAction.findOne({ action: "user.deleted", targetId: customer.id }).lean();
    expect(log!.reason).toContain("sara@t.test");
  });

  it("shopkeeper: removes their shop and products first", async () => {
    const admin = await createUser("admin", "Admin");
    const owner = await createUser("shopkeeper");
    const shop = await createShop(owner);
    await createProduct(shop);
    expect(await deleteUserAccount(admin, owner.id, owner.email, "Fake shop")).toMatchObject({ role: "shopkeeper", removedShop: true });
    expect(await Shop.exists({ _id: shop.id })).toBeNull();
    expect(await Product.countDocuments({ shopId: shop.id })).toBe(0);
    expect(await User.exists({ _id: owner.id })).toBeNull();
  });
});
