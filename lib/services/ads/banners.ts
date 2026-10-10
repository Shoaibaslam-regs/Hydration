import "server-only";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { Types } from "mongoose";
import { endOfDayInZone, startOfDayInZone, dayKey } from "@/lib/ads/dates";
import { ApiError } from "@/lib/api/errors";
import type { SessionUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { Banner, BannerImage } from "@/lib/db/models";
import type { BannerInput } from "@/lib/validation/ads";
import { logAdminAction } from "../admin/audit";
import { adTotals, type AdTotals } from "./stats";

export const BANNERS_TAG = "ads-banners";
export const MAX_BANNER_IMAGE_BYTES = 2 * 1024 * 1024;

export type PublicBanner = { id: string; title: string; subtitle: string; ctaLabel: string; imageUrl: string | null };

export type AdminBanner = PublicBanner & {
  linkUrl: string;
  imageId: string | null;
  startDate: string;
  endDate: string;
  isActive: boolean;
  sortOrder: number;
  state: "scheduled" | "running" | "ended" | "off";
  stats: AdTotals;
};

type BannerLean = {
  _id: Types.ObjectId;
  title: string;
  subtitle?: string | null;
  ctaLabel?: string | null;
  linkUrl: string;
  imageId?: Types.ObjectId | null;
  startsAt: Date;
  endsAt: Date;
  isActive?: boolean | null;
  sortOrder?: number | null;
};

const imageUrl = (id: Types.ObjectId | null | undefined) => (id ? `/api/banner-images/${id.toString()}` : null);

function toPublic(b: BannerLean): PublicBanner {
  return { id: b._id.toString(), title: b.title, subtitle: b.subtitle ?? "", ctaLabel: b.ctaLabel || "Learn more", imageUrl: imageUrl(b.imageId) };
}

/** Banners to show on the home page now. Cached; admin changes invalidate it. */
export async function listRunningBanners(): Promise<PublicBanner[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(BANNERS_TAG);
  await connectDB();
  const now = new Date();
  const rows = await Banner.find({ isActive: true, startsAt: { $lte: now }, endsAt: { $gt: now } }).sort({ sortOrder: 1, createdAt: -1 }).limit(8).lean();
  return rows.map((b) => toPublic(b as unknown as BannerLean));
}

export async function listBannersForAdmin(): Promise<AdminBanner[]> {
  await connectDB();
  const now = new Date();
  const rows = (await Banner.find({}).sort({ endsAt: -1 }).limit(100).lean()) as unknown as BannerLean[];
  const stats = await adTotals("banner", rows.map((r) => r._id), 30);
  return rows.map((b) => toAdmin(b, now, stats.get(b._id.toString())));
}

export async function getBannerForAdmin(id: string): Promise<AdminBanner | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  await connectDB();
  const b = (await Banner.findById(id).lean()) as unknown as BannerLean | null;
  if (!b) return null;
  return toAdmin(b, new Date(), (await adTotals("banner", [b._id], 30)).get(b._id.toString()));
}

function toAdmin(b: BannerLean, now: Date, stats: AdTotals | undefined): AdminBanner {
  const active = b.isActive ?? true;
  return {
    ...toPublic(b),
    linkUrl: b.linkUrl,
    imageId: b.imageId ? b.imageId.toString() : null,
    startDate: dayKey(b.startsAt),
    endDate: dayKey(new Date(b.endsAt.getTime() - 1)),
    isActive: active,
    sortOrder: b.sortOrder ?? 0,
    state: !active ? "off" : b.startsAt > now ? "scheduled" : b.endsAt > now ? "running" : "ended",
    stats: stats ?? { impressions: 0, clicks: 0 },
  };
}

function toFields(input: BannerInput) {
  return {
    title: input.title,
    subtitle: input.subtitle,
    ctaLabel: input.ctaLabel,
    linkUrl: input.linkUrl,
    imageId: input.imageId ? new Types.ObjectId(input.imageId) : null,
    startsAt: startOfDayInZone(input.startDate),
    endsAt: endOfDayInZone(input.endDate),
    isActive: input.isActive,
    sortOrder: input.sortOrder,
  };
}

async function assertImageExists(imageId: string | null) {
  if (imageId && !(await BannerImage.exists({ _id: imageId }))) {
    throw ApiError.badRequest("That image wasn't found. Upload it again.", { fieldErrors: { imageId: ["Upload the image again"] } });
  }
}

export async function createBanner(admin: SessionUser, input: BannerInput): Promise<string> {
  await connectDB();
  await assertImageExists(input.imageId);
  const b = await Banner.create(toFields(input));
  await logAdminAction(admin, "ads.banner.created", "platform", null, input.title);
  revalidateTag(BANNERS_TAG, { expire: 0 });
  return b._id.toString();
}

export async function updateBanner(admin: SessionUser, id: string, input: BannerInput): Promise<void> {
  await connectDB();
  await assertImageExists(input.imageId);
  const old = await Banner.findOneAndUpdate({ _id: id }, { $set: toFields(input) }, { projection: { imageId: 1 } }).lean();
  if (!old) throw ApiError.notFound("Banner not found");
  // Drop the previous image if it was replaced.
  if (old.imageId && old.imageId.toString() !== input.imageId) await BannerImage.deleteOne({ _id: old.imageId });
  await logAdminAction(admin, "ads.banner.updated", "platform", null, input.title);
  revalidateTag(BANNERS_TAG, { expire: 0 });
}

export async function deleteBanner(admin: SessionUser, id: string): Promise<void> {
  await connectDB();
  const b = await Banner.findOneAndDelete({ _id: id }).lean();
  if (!b) throw ApiError.notFound("Banner not found");
  if (b.imageId) await BannerImage.deleteOne({ _id: b.imageId });
  await logAdminAction(admin, "ads.banner.deleted", "platform", null, b.title);
  revalidateTag(BANNERS_TAG, { expire: 0 });
}

/** Recognize the image type from its first bytes, not from what the client claims. */
export function sniffImageType(bytes: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export async function saveBannerImage(bytes: Uint8Array): Promise<string> {
  if (bytes.length > MAX_BANNER_IMAGE_BYTES) throw ApiError.payloadTooLarge(MAX_BANNER_IMAGE_BYTES);
  const contentType = sniffImageType(bytes);
  if (!contentType) throw ApiError.badRequest("Upload a PNG, JPEG or WebP image");
  await connectDB();
  const img = await BannerImage.create({ contentType, size: bytes.length, data: Buffer.from(bytes) });
  return img._id.toString();
}

export async function getBannerImage(id: string): Promise<{ contentType: string; data: Buffer } | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  await connectDB();
  const img = await BannerImage.findById(id).lean();
  if (!img) return null;
  // Lean reads return BSON Binary rather than a Buffer.
  const raw = img.data as unknown as Buffer | { buffer: Uint8Array };
  return { contentType: img.contentType, data: Buffer.isBuffer(raw) ? raw : Buffer.from(raw.buffer) };
}

/** Where a banner click should go; null if the banner isn't showing right now. */
export async function bannerClickTarget(id: string): Promise<string | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  await connectDB();
  const now = new Date();
  const b = await Banner.findOne({ _id: id, isActive: true, startsAt: { $lte: now }, endsAt: { $gt: now } }, { linkUrl: 1 }).lean();
  return b?.linkUrl ?? null;
}
