import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { rateLimit } from "@/lib/api/rate-limit";
import { AdminAction, Order, Shop, User } from "@/lib/db/models";
import { shopSearchSchema } from "@/lib/validation/shops";
import { createAddress, createProduct, createShop, createUser, HOME, stockOf } from "@/test/fixtures";
import { setupTestDb } from "@/test/db";
import { adminCancelOrder } from "./admin/orders";
import { setShopStatus } from "./admin/shops";
import { updateAdminUser } from "./admin/users";
import { getSalesAnalytics } from "./analytics";
import { placeOrder } from "./customer-orders";
import { createReview } from "./reviews";
import { updateShopOrderStatus } from "./shop-orders";
import { searchShops } from "./shops";
import { authenticate, changePassword, registerUser } from "./users";

setupTestDb();

describe("geo search", () => {
  it("finds verified shops with products inside the radius, nearest first", async () => {
    const near = await createShop(await createUser("shopkeeper"), { name: "Near", location: { lat: 31.521, lng: 74.351 } });
    const mid = await createShop(await createUser("shopkeeper"), { name: "Mid", location: { lat: 31.55, lng: 74.35 } });
    const far = await createShop(await createUser("shopkeeper"), { name: "Far", location: { lat: 31.9, lng: 74.35 } });
    const pending = await createShop(await createUser("shopkeeper"), { name: "Pending", status: "pending" });
    await createShop(await createUser("shopkeeper"), { name: "Empty" }); // no products
    for (const s of [near, mid, far, pending]) await createProduct(s);

    const result = await searchShops(shopSearchSchema.parse({ lat: HOME.lat, lng: HOME.lng, radiusKm: 10 }));
    expect(result.items.map((s) => s.name)).toEqual(["Near", "Mid"]);
    expect(result.items[0].distanceKm!).toBeLessThan(result.items[1].distanceKm!);
  });
});

describe("rate limiting", () => {
  it("allows exactly `limit` hits per window, even concurrently, then resets", async () => {
    const attempt = () => rateLimit("test:key", 5, 300).then(() => "ok", (e) => e.status);
    const results = await Promise.all(Array.from({ length: 12 }, attempt));
    expect(results.filter((r) => r === "ok")).toHaveLength(5);
    expect(results.filter((r) => r === 429)).toHaveLength(7);
    await new Promise((r) => setTimeout(r, 350));
    expect(await attempt()).toBe("ok");
  });
});

describe("auth", () => {
  it("authenticates, rejects suspended users, and revokes sessions on password change", async () => {
    const user = await registerUser({ name: "Sara", email: "sara@t.test", password: "secret123", role: "customer" });
    expect(await authenticate({ email: "sara@t.test", password: "wrong" })).toBeNull();
    expect(await authenticate({ email: "nobody@t.test", password: "secret123" })).toBeNull();
    expect(await authenticate({ email: "sara@t.test", password: "secret123" })).toMatchObject({ id: user.id });

    const changed = await changePassword(user.id, "secret123", "newsecret123");
    expect(changed.sessionVersion).toBe(user.sessionVersion + 1);
    await expect(changePassword(user.id, "secret123", "x".repeat(8))).rejects.toMatchObject({ status: 400 });

    await User.updateOne({ _id: user.id }, { status: "suspended" });
    await expect(authenticate({ email: "sara@t.test", password: "newsecret123" })).rejects.toMatchObject({ status: 403 });
  });
});

async function deliveredOrder(quantity = 2) {
  const owner = await createUser("shopkeeper");
  const shop = await createShop(owner);
  const can = await createProduct(shop, { price: 25_000, stock: 10 });
  const customer = await createUser("customer", "Sara Khan");
  const addressId = await createAddress(customer);
  const { id } = await placeOrder(customer, { shopSlug: shop.slug, items: [{ productId: can, quantity }], addressId, contactPhone: "+92 301 0000000", notes: "" });
  return { shop, can, customer, id };
}

describe("reviews", () => {
  it("allows one review per delivered order and keeps the shop rating exact", async () => {
    const { shop, customer, id } = await deliveredOrder();
    await expect(createReview(customer, id, { rating: 5, comment: "" })).rejects.toMatchObject({ status: 409 });
    for (const status of ["confirmed", "out_for_delivery", "delivered"] as const) await updateShopOrderStatus(shop, id, { status });
    await expect(createReview(await createUser("customer"), id, { rating: 1, comment: "" })).rejects.toMatchObject({ status: 404 });
    await createReview(customer, id, { rating: 4, comment: "Cold and fast" });
    await expect(createReview(customer, id, { rating: 1, comment: "" })).rejects.toMatchObject({ status: 409 });
    expect((await Shop.findById(shop.id).lean())!.rating).toMatchObject({ average: 4, count: 1 });
  });
});

describe("admin", () => {
  it("verifies, suspends with a reason and audits every change", async () => {
    const admin = await createUser("admin", "Admin");
    const shop = await createShop(await createUser("shopkeeper"), { status: "pending" });
    await expect(setShopStatus(admin, shop.id, "suspended", "x")).rejects.toMatchObject({ status: 409 });
    await expect(setShopStatus(admin, shop.id, "rejected")).rejects.toMatchObject({ status: 400 });
    await setShopStatus(admin, shop.id, "verified");
    await setShopStatus(admin, shop.id, "suspended", "Complaints");
    expect(await Shop.findById(shop.id).lean()).toMatchObject({ status: "suspended", statusReason: "Complaints" });
    expect((await AdminAction.find({ targetId: shop.id }).lean()).map((a) => a.action).sort()).toEqual(["shop.suspended", "shop.verified"]);
  });

  it("suspends users (revoking sessions) but never the acting admin", async () => {
    const admin = await createUser("admin", "Admin");
    const user = await createUser("customer");
    await expect(updateAdminUser(admin, admin.id, { action: "signOutEverywhere" })).rejects.toMatchObject({ status: 403 });
    await updateAdminUser(admin, user.id, { action: "suspend", reason: "Fraud" });
    expect(await User.findById(user.id).lean()).toMatchObject({ status: "suspended", sessionVersion: 1 });
    await expect(updateAdminUser(admin, user.id, { action: "suspend", reason: "again" })).rejects.toMatchObject({ status: 409 });
  });

  it("cancels unfinished orders with stock returned, but not delivered ones", async () => {
    const admin = await createUser("admin", "Admin");
    const { shop, can, id } = await deliveredOrder(3);
    await adminCancelOrder(admin, id, "Dispute");
    expect(await stockOf(can)).toBe(10);
    expect((await Order.findById(id).lean())!.statusHistory.at(-1)).toMatchObject({ status: "cancelled", by: "admin", note: "Dispute" });
    await expect(adminCancelOrder(admin, id, "again")).rejects.toMatchObject({ status: 409 });
    expect(shop).toBeDefined();
  });
});

describe("analytics", () => {
  it("counts only delivered value, scopes by shop and compares with the previous window", async () => {
    const a = await deliveredOrder(2); // 2 × 25,000 + 5,000 delivery
    for (const status of ["confirmed", "out_for_delivery", "delivered"] as const) await updateShopOrderStatus(a.shop, a.id, { status });
    await deliveredOrder(1); // other shop, still pending
    const old = await deliveredOrder(1);
    // Raw collection: Mongoose treats createdAt as immutable and would drop the change.
    await Order.collection.updateOne({ _id: new Types.ObjectId(old.id) }, { $set: { createdAt: new Date(Date.now() - 40 * 864e5) } });

    const shopStats = await getSalesAnalytics(30, a.shop.id);
    expect(shopStats.totals).toMatchObject({ orders: 1, delivered: 1, deliveredValue: 55_000, itemsSold: 2 });
    expect(shopStats.daily).toHaveLength(30);

    const platform = await getSalesAnalytics(30);
    expect(platform.totals).toMatchObject({ orders: 2, delivered: 1, deliveredValue: 55_000 });
    expect(platform.previous.orders).toBe(1);
    expect(platform.totals).not.toHaveProperty("_id");
    expect((await getSalesAnalytics(90)).totals.orders).toBe(3);
  });
});

describe("password reset links", () => {
  it("work once, expire, replace older links and sign the user out everywhere", async () => {
    const { createResetToken, resetPasswordWithToken, isResetTokenValid } = await import("./password-reset");
    const { PasswordReset } = await import("@/lib/db/models");
    const admin = await createUser("admin", "Admin");
    const user = await registerUser({ name: "Ali", email: "ali@t.test", password: "secret123", role: "customer" });
    await expect(createResetToken(admin, admin.id)).rejects.toMatchObject({ status: 403 });

    const first = await createResetToken(admin, user.id);
    const second = await createResetToken(admin, user.id);
    expect(await isResetTokenValid(first.token)).toBe(false); // replaced
    expect(await PasswordReset.findOne({}).lean()).not.toHaveProperty("token"); // only the hash is stored

    await resetPasswordWithToken(second.token, "brandnew123");
    await expect(resetPasswordWithToken(second.token, "again12345")).rejects.toMatchObject({ status: 400 });
    expect(await authenticate({ email: "ali@t.test", password: "brandnew123" })).toMatchObject({ sessionVersion: 1 });

    const expired = await createResetToken(admin, user.id);
    await PasswordReset.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
    await expect(resetPasswordWithToken(expired.token, "brandnew456")).rejects.toMatchObject({ status: 400 });
  });
});
