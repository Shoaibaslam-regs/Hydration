import { describe, expect, it } from "vitest";
import { objectIdSchema, productInputSchema, productUpdateSchema, shopInputSchema } from "./shopkeeper";

const shop = {
  name: "Blue Spring",
  phone: "+92 300 1234567",
  address: { line1: "12 Main Road", city: "Lahore" },
  location: { lat: 31.52, lng: 74.35 },
  deliveryRadiusKm: 5,
  deliveryFee: 50,
  hours: { opensAt: "08:00", closesAt: "22:00" },
};

describe("shopInputSchema", () => {
  it("accepts a valid shop and fills defaults", () => {
    expect(shopInputSchema.parse(shop)).toMatchObject({ description: "", address: { area: "" } });
  });

  it("requires a location", () => {
    const r = shopInputSchema.safeParse({ ...shop, location: { lat: null, lng: null } });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe("Set your shop's location");
  });

  it("validates hours", () => {
    expect(shopInputSchema.safeParse({ ...shop, hours: { opensAt: "8am", closesAt: "22:00" } }).success).toBe(false);
    expect(shopInputSchema.safeParse({ ...shop, hours: { opensAt: "09:00", closesAt: "09:00" } }).success).toBe(false);
    // Overnight shops are allowed.
    expect(shopInputSchema.safeParse({ ...shop, hours: { opensAt: "18:00", closesAt: "02:00" } }).success).toBe(true);
  });

  it("rejects out-of-range coordinates and radius", () => {
    expect(shopInputSchema.safeParse({ ...shop, location: { lat: 95, lng: 0 } }).success).toBe(false);
    expect(shopInputSchema.safeParse({ ...shop, deliveryRadiusKm: 100 }).success).toBe(false);
  });
});

describe("productInputSchema", () => {
  const product = { name: "19L can", type: "can", price: 250, stock: 10 };

  it("accepts a valid product", () => {
    expect(productInputSchema.parse(product)).toMatchObject({ isActive: true, sizeLiters: null });
  });

  it("rejects bad price and fractional stock", () => {
    expect(productInputSchema.safeParse({ ...product, price: 0 }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...product, stock: 1.5 }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...product, type: "juice" }).success).toBe(false);
  });

  it("allows partial updates but not empty ones", () => {
    expect(productUpdateSchema.parse({ stock: 0 })).toEqual({ stock: 0 });
    expect(productUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe("objectIdSchema", () => {
  it("accepts 24-char hex ids only", () => {
    expect(objectIdSchema.safeParse("507f1f77bcf86cd799439011").success).toBe(true);
    expect(objectIdSchema.safeParse("not-an-id").success).toBe(false);
    expect(objectIdSchema.safeParse('{"$gt":""}').success).toBe(false);
  });
});
