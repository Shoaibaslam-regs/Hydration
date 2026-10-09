import { Schema, model, models, type InferSchemaType } from "mongoose";

/** One-time password reset tokens. Only a hash of the token is stored. */
const passwordResetSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// MongoDB deletes tokens once they expire.
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type PasswordResetDoc = InferSchemaType<typeof passwordResetSchema>;

const createPasswordResetModel = () => model("PasswordReset", passwordResetSchema);
// Reuse the compiled model across dev hot reloads.
export const PasswordReset =
  (models.PasswordReset as ReturnType<typeof createPasswordResetModel> | undefined) ?? createPasswordResetModel();
