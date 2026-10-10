import { describe, expect, it } from "vitest";
import { Order } from "@/lib/db/models";
import { createAddress, createShop, createUser, statusOf } from "@/test/fixtures";
import { setupTestDb } from "@/test/db";
import { cancelCustomerOrder, getCustomerOrder, listCustomerOrders, placeOrder } from "./customer-orders";
import { updateShopOrderStatus } from "./shop-orders";

setupTestDb();

async function setup(shopOverrides: Parameters<typeof createShop>[1] = {}) {
  const owner = await createUser("shopkeeper");
  const shop = await createShop(owner, { deliveryFee: 5_000, deliveryRadiusKm: 5, pricePerCan: 25_000, ...shopOverrides });
  const customer = await createUser("customer", "Sara Khan");
  const addressId = await createAddress(customer);
  const order = (quantity: number, extra: Partial<{ addressId: string; shopSlug: string }> = {}) =>
    placeOrder(customer, {
      shopSlug: extra.shopSlug ?? shop.slug,
      quantity,
      addressId: extra.addressId ?? addressId,
      contactPhone: "+92 301 0000000",
      notes: "",
    });
  return { owner, shop, customer, addressId, order };
}

describe("placeOrder", () => {
  it("prices cans from the shop, never the client", async () => {
    const { order } = await setup();
    const { id } = await order(3);
    const saved = await Order.findById(id).lean();
    expect(saved).toMatchObject({ subtotal: 75_000, deliveryFee: 5_000, total: 80_000, status: "pending" });
    expect(saved!.items).toEqual([expect.objectContaining({ name: "19L water can", type: "can", sizeLiters: 19, unitPrice: 25_000, quantity: 3 })]);
    expect(saved!.orderNumber).toMatch(/^AQ-[A-Z2-9]{8}$/);
  });

  it("rejects addresses outside the delivery radius", async () => {
    const { customer, order } = await setup();
    const far = await createAddress(customer, { lat: 31.71, lng: 73.98 });
    await expect(order(1, { addressId: far })).rejects.toMatchObject({ status: 400 });
    expect(await Order.countDocuments()).toBe(0);
  });

  it("refuses shops that aren't approved, have no price or whose plan ended", async () => {
    for (const overrides of [{ status: "pending" as const }, { pricePerCan: null }, { planEndsAt: new Date(Date.now() - 1000) }, { planEndsAt: null }]) {
      const { order } = await setup(overrides);
      await expect(order(1)).rejects.toMatchObject({ status: expect.any(Number) });
    }
    expect(await Order.countDocuments()).toBe(0);
  });

  it("only uses the customer's own addresses", async () => {
    const { shop } = await setup();
    const stranger = await createUser("customer");
    const victim = await createUser("customer");
    const victimAddress = await createAddress(victim);
    await expect(
      placeOrder(stranger, { shopSlug: shop.slug, quantity: 1, addressId: victimAddress, contactPhone: "+92 301 0000000", notes: "" }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("customer order access and cancellation", () => {
  it("lets only the owner read an order", async () => {
    const { customer, order } = await setup();
    const { id } = await order(1);
    const other = await createUser("customer");
    expect(await getCustomerOrder(customer.id, id)).toMatchObject({ id, canCancel: true, itemCount: 1 });
    expect(await getCustomerOrder(other.id, id)).toBeNull();
    expect((await listCustomerOrders(other.id, { page: 1, limit: 20 })).total).toBe(0);
  });

  it("cancels pending orders once", async () => {
    const { customer, order } = await setup();
    const { id } = await order(2);
    await cancelCustomerOrder(customer.id, id);
    expect(await statusOf(id)).toBe("cancelled");
    await expect(cancelCustomerOrder(customer.id, id)).rejects.toMatchObject({ status: 409 });
  });

  it("refuses to cancel another customer's order", async () => {
    const { order } = await setup();
    const { id } = await order(1);
    const other = await createUser("customer");
    await expect(cancelCustomerOrder(other.id, id)).rejects.toMatchObject({ status: 404 });
  });

  it("marks orders the shop updated as unread until the customer opens them", async () => {
    const { shop, customer, order } = await setup();
    const { id } = await order(1);
    expect((await listCustomerOrders(customer.id, { page: 1, limit: 20 })).items[0].unread).toBe(false);
    await updateShopOrderStatus(shop, id, { status: "confirmed" });
    expect((await listCustomerOrders(customer.id, { page: 1, limit: 20 })).items[0].unread).toBe(true);
    await getCustomerOrder(customer.id, id);
    expect((await listCustomerOrders(customer.id, { page: 1, limit: 20 })).items[0].unread).toBe(false);
  });
});
