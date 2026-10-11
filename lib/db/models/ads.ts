import { Schema, model, models, type InferSchemaType } from "mongoose";
import { AD_KINDS, CAMPAIGN_STATUSES } from "@/lib/ads/constants";

// ── Sponsored campaigns: a shop shown in the "Sponsored" slots for a period. ──
const campaignSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    status: { type: String, enum: CAMPAIGN_STATUSES, required: true, default: "pending" },
    /** Shopkeeper's note, e.g. the payment reference. */
    note: { type: String, default: "", trim: true, maxlength: 300 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    /** Shown to the shopkeeper when rejected or cancelled. */
    reviewReason: { type: String, default: "", maxlength: 300 },
    /** Removed from the shop's own history (finished campaigns only); admins still see it. */
    hiddenForShop: { type: Boolean, default: false },
  },
  { timestamps: true },
);
campaignSchema.index({ status: 1, startsAt: 1, endsAt: 1 });
campaignSchema.index({ shopId: 1, createdAt: -1 });

// ── Deals: a shop's time-limited offer, free to post. ──
const dealSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: "", trim: true, maxlength: 300 },
    endsAt: { type: Date, required: true },
    /** Set when the shopkeeper ends it early or an admin removes it. */
    removedAt: { type: Date, default: null },
    removedBy: { type: String, enum: ["shopkeeper", "admin"] },
    removedReason: { type: String, default: "", maxlength: 300 },
  },
  { timestamps: true },
);
dealSchema.index({ shopId: 1, removedAt: 1, endsAt: -1 });
dealSchema.index({ removedAt: 1, endsAt: 1, createdAt: -1 });

// ── Home page banners, managed by admins. ──
const bannerSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    subtitle: { type: String, default: "", trim: true, maxlength: 160 },
    ctaLabel: { type: String, default: "Learn more", trim: true, maxlength: 30 },
    /** Who paid for the banner, shown as "Sponsored by …". Empty for Aqua's own announcements. */
    sponsorName: { type: String, default: "", trim: true, maxlength: 60 },
    /** Same-site path ("/shops/x") or an https URL. */
    linkUrl: { type: String, required: true, trim: true, maxlength: 500 },
    imageId: { type: Schema.Types.ObjectId, ref: "BannerImage", default: null },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);
bannerSchema.index({ isActive: 1, startsAt: 1, endsAt: 1, sortOrder: 1 });

/** Uploaded banner images, stored in MongoDB (no separate file storage needed). */
const bannerImageSchema = new Schema(
  {
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

/** Daily ad counters per sponsored shop or banner, for reports. */
const adStatSchema = new Schema(
  {
    day: { type: String, required: true }, // YYYY-MM-DD in TIME_ZONE
    kind: { type: String, enum: AD_KINDS, required: true },
    refId: { type: Schema.Types.ObjectId, required: true },
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
  },
  { versionKey: false },
);
adStatSchema.index({ kind: 1, refId: 1, day: 1 }, { unique: true });

export type CampaignDoc = InferSchemaType<typeof campaignSchema>;
export type DealDoc = InferSchemaType<typeof dealSchema>;
export type BannerDoc = InferSchemaType<typeof bannerSchema>;

const createCampaign = () => model("SponsoredCampaign", campaignSchema);
const createDeal = () => model("Deal", dealSchema);
const createBanner = () => model("Banner", bannerSchema);
const createBannerImage = () => model("BannerImage", bannerImageSchema);
const createAdStat = () => model("AdStat", adStatSchema);
// Reuse compiled models across dev hot reloads.
export const SponsoredCampaign = (models.SponsoredCampaign as ReturnType<typeof createCampaign> | undefined) ?? createCampaign();
export const Deal = (models.Deal as ReturnType<typeof createDeal> | undefined) ?? createDeal();
export const Banner = (models.Banner as ReturnType<typeof createBanner> | undefined) ?? createBanner();
export const BannerImage = (models.BannerImage as ReturnType<typeof createBannerImage> | undefined) ?? createBannerImage();
export const AdStat = (models.AdStat as ReturnType<typeof createAdStat> | undefined) ?? createAdStat();
