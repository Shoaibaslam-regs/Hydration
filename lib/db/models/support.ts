import { Schema, model, models, type InferSchemaType } from "mongoose";
import { SUPPORT_CATEGORIES, SUPPORT_STATUSES, SUPPORT_USER_ROLES } from "@/lib/support/constants";

const messageSchema = new Schema(
  {
    by: { type: String, enum: [...SUPPORT_USER_ROLES, "admin"], required: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    /** Copied so the conversation reads the same if the account changes or is deleted. */
    authorName: { type: String, required: true },
    body: { type: String, required: true, maxlength: 2000 },
    at: { type: Date, required: true },
  },
  { _id: false },
);

/**
 * A conversation a customer or shopkeeper starts with the Aqua team. Messages
 * are embedded (capped at MAX_SUPPORT_MESSAGES). The unread flags drive the
 * notification counts on both sides.
 */
const supportThreadSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userRole: { type: String, enum: SUPPORT_USER_ROLES, required: true },
    /** A shopkeeper's shop when the thread was opened, if they had one. */
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", default: null },
    shopName: { type: String, default: "" },
    category: { type: String, enum: SUPPORT_CATEGORIES, required: true },
    subject: { type: String, required: true, trim: true, maxlength: 120 },
    status: { type: String, enum: SUPPORT_STATUSES, default: "open", required: true },
    messages: { type: [messageSchema], default: [] },
    lastMessageAt: { type: Date, required: true },
    lastMessageBy: { type: String, enum: [...SUPPORT_USER_ROLES, "admin"], required: true },
    unreadForAdmin: { type: Boolean, default: true },
    unreadForUser: { type: Boolean, default: false },
    /** The user deleted it from their list; a new team reply brings it back. */
    hiddenForUser: { type: Boolean, default: false },
  },
  { timestamps: true },
);

supportThreadSchema.index({ userId: 1, lastMessageAt: -1 });
supportThreadSchema.index({ status: 1, lastMessageAt: -1 });
supportThreadSchema.index({ unreadForAdmin: 1 });

export type SupportThreadDoc = InferSchemaType<typeof supportThreadSchema>;

const createSupportThreadModel = () => model("SupportThread", supportThreadSchema);
// Reuse the compiled model across dev hot reloads.
export const SupportThread =
  (models.SupportThread as ReturnType<typeof createSupportThreadModel> | undefined) ?? createSupportThreadModel();
