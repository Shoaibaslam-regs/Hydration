import { z } from "zod";
import { CAMPAIGN_STATUSES, MAX_DEAL_DAYS } from "@/lib/ads/constants";
import { paginationSchema } from "./pagination";

export const dealInputSchema = z.object({
  title: z.string().trim().min(3, "Give the deal a short title").max(80),
  description: z.string().trim().max(300).default(""),
  days: z.number({ error: "Choose how long it runs" }).int().min(1).max(MAX_DEAL_DAYS),
});
export type DealInput = z.infer<typeof dealInputSchema>;

/** A Sponsored plan request: how many months, and an optional note (e.g. the payment reference). */
export const campaignRequestSchema = z.object({
  months: z.union([z.literal(1), z.literal(2), z.literal(3)], { error: "Choose 1, 2 or 3 months" }),
  note: z.string().trim().max(300).default(""),
});
export type CampaignRequest = z.infer<typeof campaignRequestSchema>;

export const campaignListSchema = paginationSchema.extend({
  status: z.preprocess((v) => (v === "" ? undefined : v), z.enum(CAMPAIGN_STATUSES).optional()),
});

export const campaignDecisionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve") }),
  z.object({ decision: z.literal("reject"), reason: z.string().trim().min(1, "Give a reason").max(300) }),
  z.object({ decision: z.literal("cancel"), reason: z.string().trim().min(1, "Give a reason").max(300) }),
]);

export const reasonSchema = z.object({ reason: z.string().trim().min(1, "Give a reason").max(300) });

/** Banner links: a same-site path or an https URL. Never javascript:, data: etc. */
export const bannerLinkSchema = z
  .string()
  .trim()
  .max(500)
  .refine((v) => (v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\")) || /^https:\/\/[^\s/]+\.[^\s]+$/i.test(v), {
    message: "Use a path on this site (e.g. /shops) or a full https:// link",
  });

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");

export const bannerInputSchema = z
  .object({
    title: z.string().trim().min(3, "Enter a title").max(80),
    subtitle: z.string().trim().max(160).default(""),
    ctaLabel: z.string().trim().min(1).max(30).default("Learn more"),
    /** Advertiser shown as "Sponsored by …"; empty for Aqua's own banners. */
    sponsorName: z.string().trim().max(60).default(""),
    linkUrl: bannerLinkSchema,
    imageId: z.string().regex(/^[a-f0-9]{24}$/i).nullable().default(null),
    videoId: z.string().regex(/^[a-f0-9]{24}$/i).nullable().default(null),
    startDate: dateString,
    endDate: dateString,
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().min(0).max(100).default(0),
  })
  .refine((b) => b.endDate >= b.startDate, { message: "End date must be on or after the start date", path: ["endDate"] });
export type BannerInput = z.infer<typeof bannerInputSchema>;

export const adEventSchema = z.object({
  kind: z.enum(["sponsored", "banner"]),
  id: z.string().regex(/^[a-f0-9]{24}$/i),
});

/** /admin/ads search params. */
export const adminAdsQuerySchema = campaignListSchema.extend({
  tab: z.enum(["sponsored", "deals", "banners"]).default("sponsored"),
  dealState: z.enum(["running", "all"]).default("running"),
});
