import "server-only";
import { getPlatformSettings } from "./platform-settings";

/**
 * MongoDB filter for shops customers may see right now: approved, open and,
 * while plans are required, with an active plan. Use for any public listing
 * outside the main search pipeline (deals, sponsored slots).
 */
export async function listableShopFilter(now: Date): Promise<Record<string, unknown>> {
  const filter: Record<string, unknown> = { status: "verified", closure: null };
  if ((await getPlatformSettings()).requireSubscription) filter["subscription.endsAt"] = { $gt: now };
  return filter;
}
