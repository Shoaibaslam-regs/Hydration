import { Schema, model, models, type InferSchemaType } from "mongoose";
import { USER_ROLES } from "@/lib/auth/roles";
import { generatePublicId } from "@/lib/ids";

export const USER_STATUSES = ["active", "suspended"] as const;

const userSchema = new Schema(
  {
    /** Short public ID ("CU-7K2M9X" / "SK-…" / "AD-…"), shown to the user and to admins. Set on create. */
    publicId: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, required: true, default: "customer" },
    status: { type: String, enum: USER_STATUSES, required: true, default: "active" },
    /** End of a timed suspension; null = suspended until an admin lifts it. Ignored while active. */
    suspendedUntil: { type: Date, default: null },
    // Bump to invalidate every session issued to this user (e.g. password change).
    sessionVersion: { type: Number, required: true, default: 0 },
    lastLoginAt: { type: Date },
    favoriteShopIds: { type: [{ type: Schema.Types.ObjectId, ref: "Shop" }], default: [] },
  },
  { timestamps: true },
);

userSchema.index({ role: 1, createdAt: -1 });

userSchema.pre("validate", async function () {
  if (!this.publicId) this.publicId = generatePublicId((this.role as "customer" | "shopkeeper" | "admin") ?? "customer");
});

export type UserDoc = InferSchemaType<typeof userSchema>;

const createUserModel = () => model("User", userSchema);
// Reuse the compiled model across dev hot reloads.
export const User = (models.User as ReturnType<typeof createUserModel> | undefined) ?? createUserModel();
