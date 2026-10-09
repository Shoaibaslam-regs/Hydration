import { Schema, model, models, type InferSchemaType } from "mongoose";

/** Fixed-window rate-limit counters, shared by every server instance. */
const rateLimitSchema = new Schema(
  {
    /** sha256 of the logical key (keys can contain emails). */
    key: { type: String, required: true, unique: true },
    count: { type: Number, required: true },
    resetAt: { type: Date, required: true },
  },
  { versionKey: false },
);

// MongoDB deletes each counter shortly after its window ends.
rateLimitSchema.index({ resetAt: 1 }, { expireAfterSeconds: 0 });

export type RateLimitDoc = InferSchemaType<typeof rateLimitSchema>;

const createRateLimitModel = () => model("RateLimit", rateLimitSchema);
// Reuse the compiled model across dev hot reloads.
export const RateLimit = (models.RateLimit as ReturnType<typeof createRateLimitModel> | undefined) ?? createRateLimitModel();
