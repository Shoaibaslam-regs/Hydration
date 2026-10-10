import { z } from "zod";
import { PAYMENT_METHODS, SUBSCRIPTION_PAYMENT_STATUSES } from "@/lib/billing/constants";
import { PLANS } from "@/lib/plans";
import { paginationSchema } from "./pagination";

const planIds = PLANS.map((p) => p.id) as [string, ...string[]];

export const paymentSubmitSchema = z.object({
  planId: z.enum(planIds, { error: "Choose a plan" }),
  // Keep in sync with BILLING_MONTH_OPTIONS (checked by a test).
  months: z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12)], { error: "Choose how many months" }),
  method: z.enum(PAYMENT_METHODS, { error: "Choose how you paid" }),
  reference: z.string().trim().min(3, "Enter the transaction ID or receipt number").max(100),
  note: z.string().trim().max(500).default(""),
});
export type PaymentSubmitInput = z.infer<typeof paymentSubmitSchema>;

export const adminPaymentListSchema = paginationSchema.extend({
  status: z.preprocess((v) => (v === "" ? undefined : v), z.enum(SUBSCRIPTION_PAYMENT_STATUSES).optional()),
});

export const adminPaymentDecisionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve") }),
  z.object({ decision: z.literal("reject"), reason: z.string().trim().min(1, "Give a reason").max(300) }),
]);

export const settingsUpdateSchema = z
  .object({
    requireSubscription: z.boolean(),
    paymentInstructions: z.string().trim().max(2000),
    sponsorshipInfo: z.string().trim().max(2000),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });
