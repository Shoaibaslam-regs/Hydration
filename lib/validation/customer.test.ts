import { describe, expect, it } from "vitest";
import { MAX_CANS_PER_ORDER } from "@/lib/catalog";
import { canCustomerMove } from "@/lib/orders/status";
import { addressInputSchema, orderCreateSchema, reviewInputSchema } from "./customer";

const B = "bbbbbbbbbbbbbbbbbbbbbbbb";

describe("addressInputSchema", () => {
  const address = { label: "Home", line1: "5 Canal View", city: "Lahore", location: { lat: 31.5, lng: 74.3 } };

  it("accepts a valid address with defaults", () => {
    expect(addressInputSchema.parse(address)).toMatchObject({ area: "", notes: "", isDefault: false });
  });

  it("requires a map location", () => {
    const r = addressInputSchema.safeParse({ ...address, location: undefined });
    expect(r.error?.issues[0].message).toBe("Pin the address on the map");
  });
});

describe("orderCreateSchema", () => {
  const order = { shopSlug: "blue", quantity: 2, addressId: B, contactPhone: "+92 300 1234567" };

  it("accepts a valid order", () => {
    expect(orderCreateSchema.parse(order).notes).toBe("");
  });

  it("rejects bad quantities and bad ids", () => {
    for (const quantity of [0, -1, 1.5, MAX_CANS_PER_ORDER + 1, "2"]) {
      expect(orderCreateSchema.safeParse({ ...order, quantity }).success).toBe(false);
    }
    expect(orderCreateSchema.safeParse({ ...order, addressId: "x" }).success).toBe(false);
  });

  it("does not accept client-supplied prices", () => {
    const parsed = orderCreateSchema.parse({ ...order, unitPrice: 1, total: 1 });
    expect(parsed).not.toHaveProperty("total");
    expect(parsed).not.toHaveProperty("unitPrice");
  });
});

describe("reviewInputSchema", () => {
  it("requires a 1–5 integer rating", () => {
    expect(reviewInputSchema.safeParse({ rating: 0 }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ rating: 6 }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ rating: 4.5 }).success).toBe(false);
    expect(reviewInputSchema.parse({ rating: 5 })).toEqual({ rating: 5, comment: "" });
  });
});

describe("customer transitions", () => {
  it("allows cancelling only pending orders", () => {
    expect(canCustomerMove("pending", "cancelled")).toBe(true);
    expect(canCustomerMove("confirmed", "cancelled")).toBe(false);
    expect(canCustomerMove("pending", "delivered")).toBe(false);
  });
});
