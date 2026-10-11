import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * A shop's "Star customer" tag on one of its regular customers. Shops can only
 * tag people who have ordered from them; the customer sees which shops starred them.
 */
const starCustomerSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

starCustomerSchema.index({ shopId: 1, customerId: 1 }, { unique: true });
starCustomerSchema.index({ customerId: 1, createdAt: -1 });

export type StarCustomerDoc = InferSchemaType<typeof starCustomerSchema>;

const createStarCustomerModel = () => model("StarCustomer", starCustomerSchema);
// Reuse the compiled model across dev hot reloads.
export const StarCustomer =
  (models.StarCustomer as ReturnType<typeof createStarCustomerModel> | undefined) ?? createStarCustomerModel();
