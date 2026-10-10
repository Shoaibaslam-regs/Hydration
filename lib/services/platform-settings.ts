import "server-only";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import type { SessionUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { PlatformSettings } from "@/lib/db/models";
import { logAdminAction } from "./admin/audit";

export type Settings = { paymentInstructions: string; sponsorshipInfo: string };

const SETTINGS_TAG = "platform-settings";

/** Platform settings (defaults when never saved). Cached; updates invalidate the tag. */
export async function getPlatformSettings(): Promise<Settings> {
  "use cache";
  cacheLife("minutes");
  cacheTag(SETTINGS_TAG);
  await connectDB();
  const doc = await PlatformSettings.findById("platform").lean();
  return {
    paymentInstructions: doc?.paymentInstructions ?? "",
    sponsorshipInfo: doc?.sponsorshipInfo ?? "",
  };
}

export async function updatePlatformSettings(admin: SessionUser, patch: Partial<Settings>): Promise<Settings> {
  await connectDB();
  await PlatformSettings.updateOne({ _id: "platform" }, { $set: patch }, { upsert: true, runValidators: true });
  if (patch.paymentInstructions !== undefined) await logAdminAction(admin, "settings.paymentInstructions", "platform", null);
  if (patch.sponsorshipInfo !== undefined) await logAdminAction(admin, "settings.sponsorshipInfo", "platform", null);
  revalidateTag(SETTINGS_TAG, { expire: 0 });
  const doc = await PlatformSettings.findById("platform").lean();
  return {
    paymentInstructions: doc?.paymentInstructions ?? "",
    sponsorshipInfo: doc?.sponsorshipInfo ?? "",
  };
}

/** Whether a shop's trial or paid plan is running, so it may be listed and take orders. */
export function hasActivePlan(shop: { subscription?: { endsAt?: Date | null } | null }, now: Date): boolean {
  return Boolean(shop.subscription?.endsAt && shop.subscription.endsAt > now);
}
