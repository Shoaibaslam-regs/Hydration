import { describe, expect, it } from "vitest";
import { Order } from "@/lib/db/models";
import { createAddress, createProduct, createShop, createUser, stockOf } from "@/test/fixtures";
import { setupTestDb } from "@/test/db";
import { cancelCustomerOrder, getCustomerOrder, listCustomerOrders, placeOrder } from "./customer-orders";

setupTestDb();

async function setup(stock = 5) {
  const owner = await createUser("shopkeeper");
  const shop = await createShop(owner, { deliveryFee: 5_000, deliveryRadiusKm: 5 });
  const can = await createProduct(shop, { name: "19L can", price: 25_000, stock });
  const bottle = await createProduct(shop, { name: "1.5L bottle", type: "bottle", price: 8_000, stock: 100 });
  const customer = await createUser("customer", "Sara Khan");
  const addressId = await createAddress(customer);
  const order = (items: { productId: string; quantity: number }[], extra: Partial<{ addressId: string }> = {}) =>
    placeOrder(customer, { shopSlug: shop.slug, items, addressId: extra.addressId ?? addressId, contactPhone: "+92 301 0000000", notes: "" });
  return { owner, shop, can, bottle, customer, addressId, order };
}

describe("placeOrder", () => {
  it("prices from the database and reserves stock", async () => {
    const { can, order } = await setup();
    const { id } = await order([{ productId: can, quantity: 2 }]);
    const saved = await Order.findById(id).lean();
    expect(saved).toMatchObject({ subtotal: 50_000, deliveryFee: 5_000, total: 55_000, status: "pending" });
    expect(saved!.orderNumber).toMatch(/^AQ-[A-Z2-9]{8}$/);
    expect(await stockOf(can)).toBe(3);
  });

  it("rejects addresses outside the delivery radius", async () => {
    const { can, customer, order } = await setup();
    const far = await createAddress(customer, { lat: 31.71, lng: 73.98 });
    await expect(order([{ productId: can, quantity: 1 }], { addressId: far })).rejects.toMatchObject({ status: 400 });
    expect(await stockOf(can)).toBe(5);
  });

  it("refuses more than is in stock without changing stock", async () => {
    const { can, order } = await setup();
    await expect(order([{ productId: can, quantity: 6 }])).rejects.toMatchObject({ status: 409, message: expect.stringContaining("Only 5") });
    expect(await stockOf(can)).toBe(5);
  });

  it("returns earlier reservations when a later item fails", async () => {
    const { can, bottle, order } = await setup();
    await expect(order([{ productId: bottle, quantity: 3 }, { productId: can, quantity: 9 }])).rejects.toMatchObject({ status: 409 });
    expect(await stockOf(bottle)).toBe(100);
    expect(await Order.countDocuments()).toBe(0);
  });

  it("never oversells under concurrent orders", async () => {
    const { can, order } = await setup(3);
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => order([{ productId: can, quantity: 2 }])));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await stockOf(can)).toBe(1);
  });

  it("refuses unverified shops, other shops' products and inactive products", async () => {
    const { customer, addressId, can } = await setup();
    const pendingOwner = await createUser("shopkeeper");
    const pending = await createShop(pendingOwner, { status: "pending" });
    const pendingProduct = await createProduct(pending);
    const input = { contactPhone: "+92 301 0000000", notes: "", addressId };
    await expect(placeOrder(customer, { ...input, shopSlug: pending.slug, items: [{ productId: pendingProduct, quantity: 1 }] })).rejects.toMatchObject({ status: 404 });

    const otherOwner = await createUser("shopkeeper");
    const other = await createShop(otherOwner);
    await expect(placeOrder(customer, { ...input, shopSlug: other.slug, items: [{ productId: can, quantity: 1 }] })).rejects.toMatchObject({ status: 409 });
  });

  it("only uses the customer's own addresses", async () => {
    const { can, shop } = await setup();
    const stranger = await createUser("customer");
    const victim = await createUser("customer");
    const victimAddress = await createAddress(victim);
    await expect(
      placeOrder(stranger, { shopSlug: shop.slug, items: [{ productId: can, quantity: 1 }], addressId: victimAddress, contactPhone: "+92 301 0000000", notes: "" }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("customer order access and cancellation", () => {
  it("lets only the owner read an order", async () => {
    const { can, customer, order } = await setup();
    const { id } = await order([{ productId: can, quantity: 1 }]);
    const other = await createUser("customer");
    expect(await getCustomerOrder(customer.id, id)).toMatchObject({ id, canCancel: true });
    expect(await getCustomerOrder(other.id, id)).toBeNull();
    expect((await listCustomerOrders(other.id, { page: 1, limit: 20 })).total).toBe(0);
  });

  it("cancels pending orders once and returns stock", async () => {
    const { can, customer, order } = await setup();
    const { id } = await order([{ productId: can, quantity: 2 }]);
    await cancelCustomerOrder(customer.id, id);
    expect(await stockOf(can)).toBe(5);
    await expect(cancelCustomerOrder(customer.id, id)).rejects.toMatchObject({ status: 409 });
    expect(await stockOf(can)).toBe(5);
  });

  it("refuses to cancel another customer's order", async () => {
    const { can, order } = await setup();
    const { id } = await order([{ productId: can, quantity: 1 }]);
    const other = await createUser("customer");
    await expect(cancelCustomerOrder(other.id, id)).rejects.toMatchObject({ status: 404 });
  });
});
