import { Schema, model, models, type InferSchemaType } from "mongoose";

export const MAX_ADDRESSES_PER_USER = 10;

const addressSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    label: { type: String, required: true, trim: true, maxlength: 40 },
    line1: { type: String, required: true, trim: true, maxlength: 200 },
    area: { type: String, default: "", trim: true, maxlength: 100 },
    city: { type: String, required: true, trim: true, maxlength: 100 },
    notes: { type: String, default: "", trim: true, maxlength: 300 },
    location: {
      type: new Schema(
        {
          type: { type: String, enum: ["Point"], required: true, default: "Point" },
          // GeoJSON order: [longitude, latitude]
          coordinates: { type: [Number], required: true },
        },
        { _id: false },
      ),
      required: true,
    },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true },
);

addressSchema.index({ userId: 1, isDefault: -1, createdAt: 1 });

export type AddressDoc = InferSchemaType<typeof addressSchema>;

const createAddressModel = () => model("Address", addressSchema);
// Reuse the compiled model across dev hot reloads.
export const Address = (models.Address as ReturnType<typeof createAddressModel> | undefined) ?? createAddressModel();
