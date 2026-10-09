import { Schema, model, models, type InferSchemaType } from "mongoose";
import { PRODUCT_TYPES } from "@/lib/catalog";

const productSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, enum: PRODUCT_TYPES, required: true },
    description: { type: String, default: "", maxlength: 1000 },
    sizeLiters: { type: Number, min: 0 },
    /** Minor currency units. */
    price: { type: Number, required: true, min: 0, validate: Number.isInteger },
    stock: { type: Number, default: 0, min: 0, validate: Number.isInteger },
    isActive: { type: Boolean, default: true },
    imageUrl: { type: String },
  },
  { timestamps: true },
);

productSchema.index({ shopId: 1, isActive: 1, type: 1 });

export type ProductDoc = InferSchemaType<typeof productSchema>;

const createProductModel = () => model("Product", productSchema);
// Reuse the compiled model across dev hot reloads.
export const Product = (models.Product as ReturnType<typeof createProductModel> | undefined) ?? createProductModel();
