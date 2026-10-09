import { describe, expect, it } from "vitest";
import { DEFAULT_RADIUS_KM } from "@/lib/catalog";
import { shopSearchSchema, shopSlugSchema } from "./shops";

describe("shopSearchSchema", () => {
  it("treats blank form fields as unset and applies defaults", () => {
    const parsed = shopSearchSchema.parse({ q: "", type: "", maxPrice: "", radiusKm: "", lat: "", lng: "" });
    expect(parsed).toEqual({ page: 1, limit: 20, radiusKm: DEFAULT_RADIUS_KM });
  });

  it("coerces numeric query params", () => {
    const parsed = shopSearchSchema.parse({ lat: "31.5", lng: "74.3", radiusKm: "5", maxPrice: "150", minRating: "4" });
    expect(parsed).toMatchObject({ lat: 31.5, lng: 74.3, radiusKm: 5, maxPrice: 150, minRating: 4 });
  });

  it("requires lat and lng together", () => {
    expect(shopSearchSchema.safeParse({ lat: "31.5" }).success).toBe(false);
    expect(shopSearchSchema.safeParse({ lng: "74.3" }).success).toBe(false);
  });

  it("rejects out-of-range and unknown values", () => {
    expect(shopSearchSchema.safeParse({ lat: "91", lng: "0" }).success).toBe(false);
    expect(shopSearchSchema.safeParse({ radiusKm: "500" }).success).toBe(false);
    expect(shopSearchSchema.safeParse({ type: "juice" }).success).toBe(false);
    expect(shopSearchSchema.safeParse({ sort: "random" }).success).toBe(false);
  });
});

describe("shopSlugSchema", () => {
  it("accepts kebab-case and rejects anything else", () => {
    expect(shopSlugSchema.safeParse("blue-spring-2").success).toBe(true);
    expect(shopSlugSchema.safeParse("Blue Spring").success).toBe(false);
    expect(shopSlugSchema.safeParse("$where").success).toBe(false);
  });
});
