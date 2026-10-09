import { Schema, model, models, type InferSchemaType } from "mongoose";

/** Audit log of admin actions (append-only). */
const adminActionSchema = new Schema(
  {
    adminId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    adminName: { type: String, required: true },
    action: { type: String, required: true, maxlength: 60 },
    targetType: { type: String, enum: ["shop", "user", "order"], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    reason: { type: String, default: "", maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

adminActionSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
adminActionSchema.index({ createdAt: -1 });

export type AdminActionDoc = InferSchemaType<typeof adminActionSchema>;

const createAdminActionModel = () => model("AdminAction", adminActionSchema);
// Reuse the compiled model across dev hot reloads.
export const AdminAction =
  (models.AdminAction as ReturnType<typeof createAdminActionModel> | undefined) ?? createAdminActionModel();
