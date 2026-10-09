import { describe, expect, it } from "vitest";
import { ADMIN_SHOP_TRANSITIONS, canAdminMoveShop, SHOP_REASON_REQUIRED } from "./shop-status";

describe("admin shop transitions", () => {
  it("lets admins verify or reject pending shops", () => {
    expect(canAdminMoveShop("pending", "verified")).toBe(true);
    expect(canAdminMoveShop("pending", "rejected")).toBe(true);
  });

  it("suspends and reinstates verified shops", () => {
    expect(canAdminMoveShop("verified", "suspended")).toBe(true);
    expect(canAdminMoveShop("suspended", "verified")).toBe(true);
  });

  it("blocks meaningless moves", () => {
    expect(canAdminMoveShop("verified", "verified")).toBe(false);
    expect(canAdminMoveShop("pending", "suspended")).toBe(false);
    expect(canAdminMoveShop("verified", "pending")).toBe(false);
  });

  it("requires a reason for every negative outcome", () => {
    for (const targets of Object.values(ADMIN_SHOP_TRANSITIONS)) {
      for (const t of targets) if (t === "rejected" || t === "suspended") expect(SHOP_REASON_REQUIRED).toContain(t);
    }
  });
});
