import { describe, expect, it } from "vitest";
import { objectIdSchema, shopInputSchema } from "./shopkeeper";

const shop = {
  name: "Blue Spring",
  phone: "+92 300 1234567",
  address: { line1: "12 Main Road", city: "Lahore" },
  location: { lat: 31.52, lng: 74.35 },
  deliveryRadiusKm: 5,
  deliveryFee: 50,
  pricePerCan: 200,
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

  it("requires a price per can above 0", () => {
    expect(shopInputSchema.safeParse({ ...shop, pricePerCan: 0 }).success).toBe(false);
    expect(shopInputSchema.safeParse({ ...shop, pricePerCan: undefined }).error?.issues[0].message).toBe("Enter your price per can");
  });

  it("rejects out-of-range coordinates and radius", () => {
    expect(shopInputSchema.safeParse({ ...shop, location: { lat: 95, lng: 0 } }).success).toBe(false);
    expect(shopInputSchema.safeParse({ ...shop, deliveryRadiusKm: 100 }).success).toBe(false);
  });
});

describe("objectIdSchema", () => {
  it("accepts 24-char hex ids only", () => {
    expect(objectIdSchema.safeParse("507f1f77bcf86cd799439011").success).toBe(true);
    expect(objectIdSchema.safeParse("not-an-id").success).toBe(false);
    expect(objectIdSchema.safeParse('{"$gt":""}').success).toBe(false);
  });
});
