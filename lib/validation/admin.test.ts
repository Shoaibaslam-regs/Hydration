import { describe, expect, it } from "vitest";
import { percentChange } from "@/components/charts/stat-tile";
import { adminOrderListSchema, adminUserUpdateSchema, analyticsRangeSchema } from "./admin";

describe("adminUserUpdateSchema", () => {
  it("requires a reason to suspend", () => {
    expect(adminUserUpdateSchema.safeParse({ action: "suspend" }).success).toBe(false);
    expect(adminUserUpdateSchema.safeParse({ action: "suspend", reason: " " }).success).toBe(false);
    expect(adminUserUpdateSchema.parse({ action: "suspend", reason: "Fraud" })).toEqual({ action: "suspend", reason: "Fraud", days: null });
    expect(adminUserUpdateSchema.parse({ action: "suspend", reason: "Fraud", days: 7 })).toMatchObject({ days: 7 });
    expect(adminUserUpdateSchema.safeParse({ action: "suspend", reason: "Fraud", days: 5 }).success).toBe(false);
  });

  it("accepts activate / sign out and rejects unknown actions", () => {
    expect(adminUserUpdateSchema.safeParse({ action: "activate" }).success).toBe(true);
    expect(adminUserUpdateSchema.safeParse({ action: "signOutEverywhere" }).success).toBe(true);
    expect(adminUserUpdateSchema.safeParse({ action: "makeAdmin" }).success).toBe(false);
  });
});

describe("list and range queries", () => {
  it("only allows 7, 30 or 90 days", () => {
    expect(analyticsRangeSchema.parse({})).toEqual({ days: 30 });
    expect(analyticsRangeSchema.parse({ days: "7" })).toEqual({ days: 7 });
    expect(analyticsRangeSchema.safeParse({ days: "365" }).success).toBe(false);
  });

  it("validates order filters", () => {
    expect(adminOrderListSchema.safeParse({ shopId: "nope" }).success).toBe(false);
    expect(adminOrderListSchema.parse({ status: "", q: "" })).toEqual({ page: 1, limit: 20 });
  });
});

describe("percentChange", () => {
  it("computes signed whole percents and handles no baseline", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(10, 0)).toBeNull();
  });
});
