import "server-only";

/**
 * MongoDB filter for shops customers may see right now: approved, open, with a
 * can price set, and with a running trial or paid plan. The search pipeline
 * builds the same conditions in `buildSearchMatch`; use this for any other
 * public listing (deals, sponsored slots, favorites).
 */
export function listableShopFilter(now: Date): Record<string, unknown> {
  return { status: "verified", closure: null, pricePerCan: { $gt: 0 }, "subscription.endsAt": { $gt: now } };
}
