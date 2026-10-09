import { describe, expect, it } from "vitest";
import { AdminAction, Order, Product, Review, Shop, User } from "@/lib/db/models";
import { shopSearchSchema } from "@/lib/validation/shops";
import { createAddress, createProduct, createShop, createUser, HOME } from "@/test/fixtures";
import { setupTestDb } from "@/test/db";
import { adminCloseShop, adminRemoveShop, adminReopenShop } from "./admin/shops";
import { placeOrder } from "./customer-orders";
import { addFavorite } from "./favorites";
import { closeMyShop, createMyShop, getMyShop, reopenMyShop } from "./my-shop";
import { createReview } from "./reviews";
import { updateShopOrderStatus } from "./shop-orders";
import { getShopBySlug, searchShops } from "./shops";

setupTestDb();

async function setup() {
  const owner = await createUser("shopkeeper");
  const shop = await createShop(owner);
  const can = await createProduct(shop, { stock: 20 });
  const customer = await createUser("customer", "Sara Khan");
  const addressId = await createAddress(customer);
  const order = () => placeOrder(customer, { shopSlug: shop.slug, items: [{ productId: can, quantity: 1 }], addressId, contactPhone: "+92 301 0000000", notes: "" });
  const visible = async () => (await searchShops(shopSearchSchema.parse({ lat: HOME.lat, lng: HOME.lng }))).items.some((s) => s.id === shop.id);
  return { owner, shop, can, customer, order, visible };
}

describe("shopkeeper closing their shop", () => {
  it("hides the shop and blocks new orders, but existing orders can still be handled", async () => {
    const { owner, shop, order, visible } = await setup();
    const { id: existing } = await order();
    expect(await visible()).toBe(true);

    const closed = await closeMyShop(owner.id, "Closed for Eid");
    expect(closed.closure).toMatchObject({ by: "shopkeeper", reason: "Closed for Eid" });
    expect(await visible()).toBe(false);
    await expect(order()).rejects.toMatchObject({ status: 409 });
    expect((await getShopBySlug(shop.slug))?.closure).toEqual({ by: "shopkeeper", reason: "Closed for Eid" });
    await updateShopOrderStatus(shop, existing, { status: "confirmed" });
    await expect(closeMyShop(owner.id)).rejects.toMatchObject({ status: 409 });

    expect((await reopenMyShop(owner.id)).closure).toBeNull();
    expect(await visible()).toBe(true);
    await expect(reopenMyShop(owner.id)).rejects.toMatchObject({ status: 409 });
    await expect(order()).resolves.toMatchObject({ orderNumber: expect.any(String) });
  });
});

describe("admin closing a shop", () => {
  it("takes over a shopkeeper closure so only an admin can reopen, and is audited", async () => {
    const { owner, shop, visible } = await setup();
    const admin = await createUser("admin", "Admin");
    await closeMyShop(owner.id, "Holiday");
    await adminCloseShop(admin, shop.id, "Health inspection");
    expect((await getMyShop(owner.id))!.closure).toMatchObject({ by: "admin", reason: "Health inspection" });
    await expect(reopenMyShop(owner.id)).rejects.toMatchObject({ status: 403 });
    await expect(adminCloseShop(admin, shop.id, "again")).rejects.toMatchObject({ status: 409 });

    await adminReopenShop(admin, shop.id);
    expect(await visible()).toBe(true);
    await expect(adminReopenShop(admin, shop.id)).rejects.toMatchObject({ status: 409 });
    expect((await AdminAction.find({ targetId: shop.id }).lean()).map((a) => a.action).sort()).toEqual(["shop.closed", "shop.reopened"]);
  });
});

describe("admin removing a shop", () => {
  it("cancels unfinished orders, deletes its data, keeps order history and the owner account", async () => {
    const { owner, shop, customer, order } = await setup();
    const admin = await createUser("admin", "Admin");
    const { id: delivered } = await order();
    for (const status of ["confirmed", "out_for_delivery", "delivered"] as const) await updateShopOrderStatus(shop, delivered, { status });
    await createReview(customer, delivered, { rating: 5, comment: "" });
    const { id: pending } = await order();
    await addFavorite(customer.id, shop.id);

    expect(await adminRemoveShop(admin, shop.id, "Fraudulent listing")).toEqual({ cancelledOrders: 1 });

    expect(await Shop.exists({ _id: shop.id })).toBeNull();
    expect(await Product.countDocuments({ shopId: shop.id })).toBe(0);
    expect(await Review.countDocuments({ shopId: shop.id })).toBe(0);
    expect((await User.findById(customer.id).lean())!.favoriteShopIds).toHaveLength(0);
    expect(await Order.findById(delivered).lean()).toMatchObject({ status: "delivered" });
    expect((await Order.findById(pending).lean())!.statusHistory.at(-1)).toMatchObject({
      status: "cancelled",
      by: "admin",
      note: "Shop removed: Fraudulent listing",
    });
    expect(await AdminAction.countDocuments({ action: "shop.removed", targetId: owner.id })).toBe(1);
    await expect(adminRemoveShop(admin, shop.id, "again")).rejects.toMatchObject({ status: 404 });

    // The owner keeps their account and can register a new shop.
    expect(await User.exists({ _id: owner.id })).not.toBeNull();
    await expect(
      createMyShop(owner.id, {
        name: "Second Try",
        description: "",
        phone: "+92 300 1234567",
        address: { line1: "1 Road", area: "", city: "Lahore" },
        location: HOME,
        deliveryRadiusKm: 5,
        deliveryFee: 0,
        hours: { opensAt: "08:00", closesAt: "22:00" },
      }),
    ).resolves.toMatchObject({ status: "pending" });
  });
});

describe("shopkeeper deleting their shop", () => {
  it("requires the shop name, then removes it and cancels unfinished orders", async () => {
    const { owner, shop, order } = await setup();
    const { deleteMyShop } = await import("./my-shop");
    const { id: pending } = await order();
    await expect(deleteMyShop(owner.id, "wrong name")).rejects.toMatchObject({ status: 400 });
    expect(await deleteMyShop(owner.id, `  ${shop.name.toUpperCase()} `)).toEqual({ cancelledOrders: 1 });
    expect(await Shop.exists({ _id: shop.id })).toBeNull();
    expect(await Product.countDocuments({ shopId: shop.id })).toBe(0);
    expect((await Order.findById(pending).lean())!.statusHistory.at(-1)).toMatchObject({ status: "cancelled", by: "shopkeeper" });
    expect(await getMyShop(owner.id)).toBeNull();
    await expect(deleteMyShop(owner.id, shop.name)).rejects.toMatchObject({ status: 404 });
    // Another shopkeeper can't delete someone else's shop by guessing its name.
    const other = await setup();
    const intruder = await createUser("shopkeeper");
    await expect(deleteMyShop(intruder.id, other.shop.name)).rejects.toMatchObject({ status: 404 });
    expect(await Shop.exists({ _id: other.shop.id })).not.toBeNull();
  });
});
