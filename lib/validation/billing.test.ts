import { describe, expect, it } from "vitest";
import { BILLING_MONTH_OPTIONS } from "@/lib/billing/constants";
import { adminPaymentDecisionSchema, paymentSubmitSchema, settingsUpdateSchema } from "./billing";

const valid = { planId: "monthly", months: 3, method: "jazzcash", reference: "TXN123456" };

describe("paymentSubmitSchema", () => {
  it("accepts every offered month option and nothing else", () => {
    for (const months of BILLING_MONTH_OPTIONS) expect(paymentSubmitSchema.safeParse({ ...valid, months }).success).toBe(true);
    expect(paymentSubmitSchema.safeParse({ ...valid, months: 2 }).success).toBe(false);
  });

  it("ignores a client-sent amount and requires a reference", () => {
    expect(paymentSubmitSchema.parse({ ...valid, amount: 1 })).not.toHaveProperty("amount");
    expect(paymentSubmitSchema.safeParse({ ...valid, reference: "  " }).success).toBe(false);
    // Retired plans and the free trial can't be bought.
    for (const planId of ["growth", "trial", "platinum"]) expect(paymentSubmitSchema.safeParse({ ...valid, planId }).success).toBe(false);
  });
});

describe("admin schemas", () => {
  it("needs a reason to reject, and a non-empty settings patch", () => {
    expect(adminPaymentDecisionSchema.safeParse({ decision: "reject" }).success).toBe(false);
    expect(adminPaymentDecisionSchema.safeParse({ decision: "approve" }).success).toBe(true);
    expect(settingsUpdateSchema.safeParse({}).success).toBe(false);
    expect(settingsUpdateSchema.parse({ paymentInstructions: " Pay here " })).toEqual({ paymentInstructions: "Pay here" });
    expect(settingsUpdateSchema.safeParse({ requireSubscription: true }).success).toBe(false);
  });

  it("stores a valid IBAN without spaces and refuses a wrong one", () => {
    expect(settingsUpdateSchema.parse({ iban: "pk36 scbl 0000 0011 2345 6702" })).toEqual({ iban: "PK36SCBL0000001123456702" });
    expect(settingsUpdateSchema.parse({ iban: "" })).toEqual({ iban: "" });
    expect(settingsUpdateSchema.safeParse({ iban: "PK37SCBL0000001123456702" }).success).toBe(false);
  });
});
