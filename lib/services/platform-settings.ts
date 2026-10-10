import "server-only";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import type { SessionUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { PlatformSettings } from "@/lib/db/models";
import { logAdminAction } from "./admin/audit";

export type Settings = { requireSubscription: boolean; paymentInstructions: string };

const SETTINGS_TAG = "platform-settings";

/** Platform settings (defaults when never saved). Cached; updates invalidate the tag. */
export async function getPlatformSettings(): Promise<Settings> {
  "use cache";
  cacheLife("minutes");
  cacheTag(SETTINGS_TAG);
  await connectDB();
  const doc = await PlatformSettings.findById("platform").lean();
  return {
    requireSubscription: doc?.requireSubscription ?? false,
    paymentInstructions: doc?.paymentInstructions ?? "",
  };
}

export async function updatePlatformSettings(admin: SessionUser, patch: Partial<Settings>): Promise<Settings> {
  await connectDB();
  await PlatformSettings.updateOne({ _id: "platform" }, { $set: patch }, { upsert: true, runValidators: true });
  if (patch.requireSubscription !== undefined) {
    await logAdminAction(admin, patch.requireSubscription ? "settings.requireSubscription.on" : "settings.requireSubscription.off", "platform", null);
  }
  if (patch.paymentInstructions !== undefined) await logAdminAction(admin, "settings.paymentInstructions", "platform", null);
  revalidateTag(SETTINGS_TAG, { expire: 0 });
  const doc = await PlatformSettings.findById("platform").lean();
  return { requireSubscription: doc?.requireSubscription ?? false, paymentInstructions: doc?.paymentInstructions ?? "" };
}

/** Whether a shop may be listed and take orders given the subscription rule. */
export function hasActivePlan(shop: { subscription?: { endsAt?: Date | null } | null }, now: Date): boolean {
  return Boolean(shop.subscription?.endsAt && shop.subscription.endsAt > now);
}
