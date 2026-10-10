import { Schema, model, models, type InferSchemaType } from "mongoose";
import { PRODUCT_TYPES } from "@/lib/catalog";
import { SLUG_PATTERN } from "@/lib/validation/shops";

export const SHOP_STATUSES = ["pending", "verified", "rejected", "suspended"] as const;
export type ShopStatus = (typeof SHOP_STATUSES)[number];

const pointSchema = new Schema(
  {
    type: { type: String, enum: ["Point"], required: true, default: "Point" },
    // GeoJSON order: [longitude, latitude]
    coordinates: { type: [Number], required: true },
  },
  { _id: false },
);

const addressSchema = new Schema(
  {
    line1: { type: String, required: true, trim: true },
    area: { type: String, default: "", trim: true },
    city: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const closureSchema = new Schema(
  {
    by: { type: String, enum: ["shopkeeper", "admin"], required: true },
    at: { type: Date, required: true },
    reason: { type: String, default: "", maxlength: 300 },
  },
  { _id: false },
);

const shopSchema = new Schema(
  {
    // One shop per shopkeeper account.
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, match: SLUG_PATTERN },
    description: { type: String, default: "", maxlength: 2000 },
    phone: { type: String, required: true, trim: true },
    address: { type: addressSchema, required: true },
    location: { type: pointSchema, required: true },
    deliveryRadiusKm: { type: Number, default: 5, min: 0 },
    /** Minor currency units. */
    deliveryFee: { type: Number, default: 0, min: 0 },
    hours: {
      opensAt: { type: String, default: "08:00" },
      closesAt: { type: String, default: "22:00" },
    },
    status: { type: String, enum: SHOP_STATUSES, default: "pending", required: true },
    /** Set by an admin when rejecting or suspending; shown to the shopkeeper. */
    statusReason: { type: String, default: "", maxlength: 500 },
    verifiedAt: { type: Date },
    /**
     * Set while the shop is closed: hidden from search and not taking new
     * orders (existing orders can still be handled). Independent of the
     * verification status. Closed by an admin → only an admin can reopen.
     */
    closure: { type: closureSchema, default: null },
    /**
     * The shop's running deal that ends last, copied here so search can filter
     * on "has a deal" and show it on cards. Refreshed by refreshShopDeal().
     */
    featuredDeal: {
      type: new Schema({ title: { type: String, required: true }, endsAt: { type: Date, required: true } }, { _id: false }),
      default: null,
    },
    /**
     * Public "Verified" trust badge, granted by an admin to shops the Aqua team
     * has checked further. Separate from `status` (every listed shop is
     * approved); null when the shop doesn't have it.
     */
    verifiedBadge: {
      type: new Schema(
        { grantedAt: { type: Date, required: true }, grantedBy: { type: Schema.Types.ObjectId, ref: "User", required: true } },
        { _id: false },
      ),
      default: null,
    },
    /**
     * Current paid plan, set when an admin approves a subscription payment.
     * Only enforced while PlatformSettings.requireSubscription is on.
     */
    subscription: {
      type: new Schema({ planId: { type: String, required: true }, endsAt: { type: Date, required: true } }, { _id: false }),
      default: null,
    },
    imageUrl: { type: String },
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0, min: 0 },
    },
    // Denormalized from active products by refreshShopCatalogSummary() so
    // search can filter/sort inside $geoNear without a $lookup.
    productTypes: { type: [String], enum: PRODUCT_TYPES, default: [] },
    /** Cheapest active product, minor units; null when the shop has none. */
    minPrice: { type: Number, default: null },
  },
  { timestamps: true },
);

shopSchema.index({ location: "2dsphere" });
shopSchema.index({ status: 1, "rating.average": -1 });
shopSchema.index({ status: 1, "address.city": 1 });
shopSchema.index({ "subscription.endsAt": 1 });
shopSchema.index({ "featuredDeal.endsAt": 1 });

export type ShopDoc = InferSchemaType<typeof shopSchema>;

const createShopModel = () => model("Shop", shopSchema);
// Reuse the compiled model across dev hot reloads.
export const Shop = (models.Shop as ReturnType<typeof createShopModel> | undefined) ?? createShopModel();
