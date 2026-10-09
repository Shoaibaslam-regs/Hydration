import { describe, expect, it } from "vitest";
import { Product, Shop } from "@/lib/db/models";
import { createAddress, createProduct, createShop, createUser, stockOf } from "@/test/fixtures";
import { setupTestDb } from "@/test/db";
import { placeOrder } from "./customer-orders";
import { createMyProduct, deleteMyProduct, getMyProduct, listMyProducts, updateMyProduct } from "./my-products";
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

describe("products", () => {
  it("keeps the search summary in sync", async () => {
    const owner = await createUser("shopkeeper");
    const shop = await createShop(owner);
    const p = await createMyProduct(shop, { name: "Can", type: "can", description: "", sizeLiters: 19, price: 250, stock: 5, isActive: true });
    await createMyProduct(shop, { name: "Bottle", type: "bottle", description: "", sizeLiters: null, price: 80, stock: 5, isActive: true });
    expect(await Shop.findById(shop.id).lean()).toMatchObject({ productTypes: ["bottle", "can"], minPrice: 8_000 });
    await updateMyProduct(shop, p.id, { isActive: false });
    expect(await Shop.findById(shop.id).lean()).toMatchObject({ productTypes: ["bottle"] });
  });

  it("partial updates leave other fields alone", async () => {
    const owner = await createUser("shopkeeper");
    const shop = await createShop(owner);
    const p = await createMyProduct(shop, { name: "Can", type: "can", description: "Filtered", sizeLiters: 19, price: 250, stock: 5, isActive: false });
    expect(await updateMyProduct(shop, p.id, { stock: 9 })).toMatchObject({ stock: 9, description: "Filtered", sizeLiters: 19, isActive: false, price: 25_000 });
  });

  it("isolates shops from each other", async () => {
    const a = await createShop(await createUser("shopkeeper"));
    const b = await createShop(await createUser("shopkeeper"));
    const id = await createProduct(a);
    expect(await getMyProduct(b, id)).toBeNull();
    await expect(updateMyProduct(b, id, { price: 1 })).rejects.toMatchObject({ status: 404 });
    await expect(deleteMyProduct(b, id)).rejects.toMatchObject({ status: 404 });
    expect((await listMyProducts(b, { page: 1, limit: 20 })).total).toBe(0);
    expect(await Product.countDocuments({ _id: id })).toBe(1);
  });
});

describe("shopkeeper order handling", () => {
  async function withOrder(quantity = 2) {
    const owner = await createUser("shopkeeper");
    const shop = await createShop(owner);
    const can = await createProduct(shop, { stock: 10 });
    const customer = await createUser("customer");
    const addressId = await createAddress(customer);
    const { id } = await placeOrder(customer, { shopSlug: shop.slug, items: [{ productId: can, quantity }], addressId, contactPhone: "+92 301 0000000", notes: "" });
    return { shop, can, id };
  }

  it("follows the status machine and marks cash orders paid on delivery", async () => {
    const { shop, id } = await withOrder();
    await expect(updateShopOrderStatus(shop, id, { status: "delivered" })).rejects.toMatchObject({ status: 409 });
    for (const status of ["confirmed", "out_for_delivery", "delivered"] as const) await updateShopOrderStatus(shop, id, { status });
    const order = await getShopOrder(shop, id);
    expect(order).toMatchObject({ status: "delivered", payment: { status: "paid" }, nextStatuses: [] });
    expect(order!.history.map((h) => h.status)).toEqual(["pending", "confirmed", "out_for_delivery", "delivered"]);
  });

  it("requires a reason to reject and returns stock", async () => {
    const { shop, can, id } = await withOrder(3);
    expect(await stockOf(can)).toBe(7);
    await expect(updateShopOrderStatus(shop, id, { status: "rejected" })).rejects.toMatchObject({ status: 400 });
    await updateShopOrderStatus(shop, id, { status: "rejected", note: "Out today" });
    expect(await stockOf(can)).toBe(10);
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

  it("hides other shops' orders", async () => {
    const { id } = await withOrder();
    const other = await createShop(await createUser("shopkeeper"));
    expect(await getShopOrder(other, id)).toBeNull();
    await expect(updateShopOrderStatus(other, id, { status: "confirmed" })).rejects.toMatchObject({ status: 404 });
    expect((await listShopOrders(other, { page: 1, limit: 20 })).total).toBe(0);
  });
});
