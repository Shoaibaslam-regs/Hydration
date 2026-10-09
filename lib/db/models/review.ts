import { Schema, model, models, type InferSchemaType } from "mongoose";

const reviewSchema = new Schema(
  {
    // One review per delivered order.
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    /** Snapshot of the reviewer's first name for public display. */
    authorName: { type: String, required: true, maxlength: 40 },
    rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
    comment: { type: String, default: "", trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);

reviewSchema.index({ shopId: 1, createdAt: -1 });

export type ReviewDoc = InferSchemaType<typeof reviewSchema>;

const createReviewModel = () => model("Review", reviewSchema);
// Reuse the compiled model across dev hot reloads.
export const Review = (models.Review as ReturnType<typeof createReviewModel> | undefined) ?? createReviewModel();
