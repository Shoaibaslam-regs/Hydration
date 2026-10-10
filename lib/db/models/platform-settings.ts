import { Schema, model, models, type InferSchemaType } from "mongoose";

/** Platform-wide settings an admin can change. A single document with _id "platform". */
const platformSettingsSchema = new Schema(
  {
    _id: { type: String, default: "platform" },
    /** Where shopkeepers send subscription payments (account numbers etc.), shown on their billing page. */
    paymentInstructions: { type: String, default: "", maxlength: 2000 },
    /** Sponsorship price and how to pay, shown on shopkeepers' Promote page. */
    sponsorshipInfo: { type: String, default: "", maxlength: 2000 },
  },
  { timestamps: true },
);

export type PlatformSettingsDoc = InferSchemaType<typeof platformSettingsSchema>;

const createPlatformSettingsModel = () => model("PlatformSettings", platformSettingsSchema);
// Reuse the compiled model across dev hot reloads.
export const PlatformSettings =
  (models.PlatformSettings as ReturnType<typeof createPlatformSettingsModel> | undefined) ?? createPlatformSettingsModel();
