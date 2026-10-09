import { Schema, model, models, type InferSchemaType } from "mongoose";
import { PRODUCT_TYPES } from "@/lib/catalog";
import { ORDER_STATUSES } from "@/lib/orders/status";

// Order lines snapshot product details so later product edits/deletions
// don't change past orders.
const orderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    type: { type: String, enum: PRODUCT_TYPES, required: true },
    sizeLiters: { type: Number },
    /** Minor currency units. */
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
    /** Minor currency units. */
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const statusEventSchema = new Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    at: { type: Date, required: true },
    by: { type: String, enum: ["customer", "shopkeeper", "admin", "system"], required: true },
    note: { type: String, maxlength: 300 },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true },
    items: { type: [orderItemSchema], required: true, validate: (v: unknown[]) => v.length > 0 },
    /** All amounts in minor currency units. */
    subtotal: { type: Number, required: true, min: 0 },
    deliveryFee: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    deliveryAddress: {
      type: new Schema(
        {
          line1: { type: String, required: true },
          area: { type: String, default: "" },
          city: { type: String, required: true },
          notes: { type: String, default: "", maxlength: 300 },
        },
        { _id: false },
      ),
      required: true,
    },
    contactName: { type: String, required: true },
    contactPhone: { type: String, required: true },
    status: { type: String, enum: ORDER_STATUSES, required: true, default: "pending" },
    statusHistory: { type: [statusEventSchema], default: [] },
    // Customer order payment. Kept separate from shop subscription billing.
    payment: {
      type: new Schema(
        {
          method: { type: String, enum: ["cash_on_delivery"], required: true, default: "cash_on_delivery" },
          status: { type: String, enum: ["unpaid", "paid", "refunded"], required: true, default: "unpaid" },
        },
        { _id: false },
      ),
      required: true,
      default: () => ({}),
    },
  },
  { timestamps: true },
);

orderSchema.index({ shopId: 1, status: 1, createdAt: -1 });
orderSchema.index({ shopId: 1, createdAt: -1 });
orderSchema.index({ customerId: 1, createdAt: -1 });
// Platform-wide date-range analytics and exports.
orderSchema.index({ createdAt: -1 });

export type OrderDoc = InferSchemaType<typeof orderSchema>;

const createOrderModel = () => model("Order", orderSchema);
// Reuse the compiled model across dev hot reloads.
export const Order = (models.Order as ReturnType<typeof createOrderModel> | undefined) ?? createOrderModel();
