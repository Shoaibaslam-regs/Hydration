// Advertising rules shared by server and client code.

/** Sponsored shops shown above the first page of search results. */
export const SPONSORED_SLOTS = 2;
/** The Sponsored plan: a fixed monthly price (minor units, PKR 500) for 1–3 months at a time. */
export const SPONSOR_PLAN_MONTHLY_PRICE = 50_000;
export const SPONSOR_PLAN_MONTHS = [1, 2, 3] as const;
export type SponsorPlanMonths = (typeof SPONSOR_PLAN_MONTHS)[number];
export const CAMPAIGN_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

/** Running deals a shop can have at once, and how long one can last. */
export const MAX_RUNNING_DEALS = 3;
export const MAX_DEAL_DAYS = 30;

export const AD_KINDS = ["sponsored", "banner"] as const;
export type AdKind = (typeof AD_KINDS)[number];

