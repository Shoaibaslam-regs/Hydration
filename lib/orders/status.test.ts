import { describe, expect, it } from "vitest";
import { canShopkeeperMove, FINAL_ORDER_STATUSES, ORDER_STATUSES, REASON_REQUIRED, SHOPKEEPER_TRANSITIONS } from "./status";

describe("shopkeeper order transitions", () => {
  it("follows the happy path", () => {
    expect(canShopkeeperMove("pending", "confirmed")).toBe(true);
    expect(canShopkeeperMove("confirmed", "out_for_delivery")).toBe(true);
    expect(canShopkeeperMove("out_for_delivery", "delivered")).toBe(true);
  });

  it("does not allow skipping steps or going backwards", () => {
    expect(canShopkeeperMove("pending", "delivered")).toBe(false);
    expect(canShopkeeperMove("pending", "out_for_delivery")).toBe(false);
    expect(canShopkeeperMove("delivered", "pending")).toBe(false);
    expect(canShopkeeperMove("confirmed", "rejected")).toBe(false);
  });

  it("makes final statuses terminal", () => {
    for (const s of FINAL_ORDER_STATUSES) expect(SHOPKEEPER_TRANSITIONS[s]).toEqual([]);
  });

  it("only targets known statuses", () => {
    for (const targets of Object.values(SHOPKEEPER_TRANSITIONS)) {
      for (const t of targets) expect(ORDER_STATUSES).toContain(t);
    }
  });

  it("requires a reason for every way an order can fail", () => {
    expect(REASON_REQUIRED).toEqual(expect.arrayContaining(["rejected", "cancelled"]));
  });
});
