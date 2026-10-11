import { describe, expect, it } from "vitest";
import { Shop } from "@/lib/db/models";
import { createShop, createUser, placeTestOrder, statusOf } from "@/test/fixtures";
import { setupTestDb } from "@/test/db";
import { createMyShop, updateMyShop } from "./my-shop";
import { getShopOrder, listShopOrders, updateShopOrderStatus } from "./shop-orders";

setupTestDb();

const shopInput = {
  name: "Blue Spring",
  description: "",
  phone: "+92 300 1234567",
  address: { line1: "12 Main Rd", area: "Gulberg", city: "Lahore" },
  location: { lat: 31.52, lng: 74.35 },
  deliveryRadiusKm: 5,
  deliveryFee: 50,
  pricePerCan: 200,
  hours: { opensAt: "08:00", closesAt: "22:00" },
};

describe("shop registration", () => {
  it("creates a pending shop, one per owner, with unique slugs", async () => {
    const a = await createUser("shopkeeper");
    const b = await createUser("shopkeeper");
    const shop = await createMyShop(a.id, shopInput);
    expect(shop).toMatchObject({ slug: "blue-spring", status: "pending", deliveryFee: 5_000 });
    await expect(createMyShop(a.id, shopInput)).rejects.toMatchObject({ status: 409 });
    expect((await createMyShop(b.id, shopInput)).slug).toMatch(/^blue-spring-[a-f0-9]{4}$/);
  });

  it("resubmits rejected shops and locks suspended ones", async () => {
    const owner = await createUser("shopkeeper");
    const shop = await createMyShop(owner.id, shopInput);
    await Shop.updateOne({ _id: shop.id }, { status: "rejected", statusReason: "Bad phone" });
    expect(await updateMyShop(owner.id, { ...shopInput, name: "Blue Spring 2" })).toMatchObject({
      status: "pending",
      statusReason: "",
      slug: "blue-spring",
    });
    await Shop.updateOne({ _id: shop.id }, { status: "suspended" });
    await expect(updateMyShop(owner.id, shopInput)).rejects.toMatchObject({ status: 403 });
  });
});

describe("price per can", () => {
  it("is stored in minor units and required to be listed", async () => {
    const owner = await createUser("shopkeeper");
    const shop = await createMyShop(owner.id, { ...shopInput, pricePerCan: 120 });
    expect(shop.pricePerCan).toBe(12_000);
    expect((await updateMyShop(owner.id, { ...shopInput, pricePerCan: 135.5 })).pricePerCan).toBe(13_550);
  });
});

describe("shopkeeper order handling", () => {
  async function withOrder(quantity = 2) {
    const owner = await createUser("shopkeeper");
    const shop = await createShop(owner);
    const { id } = await placeTestOrder(shop, quantity);
    return { shop, id };
  }

  it("follows the status machine and marks cash orders paid on delivery", async () => {
    const { shop, id } = await withOrder();
    await expect(updateShopOrderStatus(shop, id, { status: "delivered" })).rejects.toMatchObject({ status: 409 });
    for (const status of ["confirmed", "out_for_delivery", "delivered"] as const) await updateShopOrderStatus(shop, id, { status });
    const order = await getShopOrder(shop, id);
    expect(order).toMatchObject({ status: "delivered", payment: { status: "paid" }, nextStatuses: [] });
    expect(order!.history.map((h) => h.status)).toEqual(["pending", "confirmed", "out_for_delivery", "delivered"]);
  });

  it("requires a reason to reject", async () => {
    const { shop, id } = await withOrder(3);
    await expect(updateShopOrderStatus(shop, id, { status: "rejected" })).rejects.toMatchObject({ status: 400 });
    await updateShopOrderStatus(shop, id, { status: "rejected", note: "Out today" });
    expect(await statusOf(id)).toBe("rejected");
  });

  it("lets exactly one of two concurrent updates win", async () => {
    const { shop, id } = await withOrder();
    const results = await Promise.allSettled([
      updateShopOrderStatus(shop, id, { status: "confirmed" }),
      updateShopOrderStatus(shop, id, { status: "confirmed" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await getShopOrder(shop, id))!.history).toHaveLength(2);
  });

  it("shows the customer's ID on the shop's orders", async () => {
    const { shop, id } = await withOrder();
    expect((await getShopOrder(shop, id))!.customerPublicId).toMatch(/^CU-[A-Z2-9]{6}$/);
    expect((await listShopOrders(shop, { page: 1, limit: 20 })).items[0].customerPublicId).toMatch(/^CU-/);
  });

  it("hides other shops' orders", async () => {
    const { id } = await withOrder();
    const other = await createShop(await createUser("shopkeeper"));
    expect(await getShopOrder(other, id)).toBeNull();
    await expect(updateShopOrderStatus(other, id, { status: "confirmed" })).rejects.toMatchObject({ status: 404 });
    expect((await listShopOrders(other, { page: 1, limit: 20 })).total).toBe(0);
  });
});
