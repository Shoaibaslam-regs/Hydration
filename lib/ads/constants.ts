// Advertising rules shared by server and client code.

/** Sponsored shops shown above the first page of search results. */
export const SPONSORED_SLOTS = 2;
/** Campaign lengths a shopkeeper can request, in weeks. */
export const CAMPAIGN_WEEKS = [1, 2, 4] as const;
export type CampaignWeeks = (typeof CAMPAIGN_WEEKS)[number];
export const CAMPAIGN_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

/** Running deals a shop can have at once, and how long one can last. */
export const MAX_RUNNING_DEALS = 3;
export const MAX_DEAL_DAYS = 30;

export const AD_KINDS = ["sponsored", "banner"] as const;
export type AdKind = (typeof AD_KINDS)[number];

/** The plan whose shops are sponsored automatically ("Priority placement in search"). */
export const SPONSORED_PLAN_ID = "pro";
