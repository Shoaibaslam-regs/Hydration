import { Schema, model, models, type InferSchemaType } from "mongoose";
import { BILLING_MONTH_OPTIONS, PAYMENT_METHODS, SUBSCRIPTION_PAYMENT_STATUSES } from "@/lib/billing/constants";

/**
 * A shopkeeper's subscription payment, made outside the site (bank transfer,
 * wallet) and reviewed by an admin. Separate from customer order payments.
 */
const subscriptionPaymentSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    planId: { type: String, required: true },
    months: { type: Number, enum: BILLING_MONTH_OPTIONS, required: true },
    /** Minor currency units, computed on the server from the plan price. */
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    /** Transaction ID / receipt number the shopkeeper got from their bank or wallet. */
    reference: { type: String, required: true, trim: true, maxlength: 100 },
    note: { type: String, default: "", trim: true, maxlength: 500 },
    status: { type: String, enum: SUBSCRIPTION_PAYMENT_STATUSES, required: true, default: "pending" },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    /** Shown to the shopkeeper when rejected. */
    reviewReason: { type: String, default: "", maxlength: 300 },
    /** The plan period this payment bought, set on approval. */
    periodStart: { type: Date },
    periodEnd: { type: Date },
  },
  { timestamps: true },
);

subscriptionPaymentSchema.index({ status: 1, createdAt: 1 });
subscriptionPaymentSchema.index({ shopId: 1, createdAt: -1 });
subscriptionPaymentSchema.index({ status: 1, reviewedAt: -1 });
// At most one payment awaiting review per shop.
subscriptionPaymentSchema.index({ shopId: 1 }, { unique: true, partialFilterExpression: { status: "pending" }, name: "one_pending_per_shop" });

export type SubscriptionPaymentDoc = InferSchemaType<typeof subscriptionPaymentSchema>;

const createSubscriptionPaymentModel = () => model("SubscriptionPayment", subscriptionPaymentSchema);
// Reuse the compiled model across dev hot reloads.
export const SubscriptionPayment =
  (models.SubscriptionPayment as ReturnType<typeof createSubscriptionPaymentModel> | undefined) ??
  createSubscriptionPaymentModel();
