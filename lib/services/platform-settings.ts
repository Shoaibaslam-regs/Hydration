import "server-only";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import type { SessionUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/connect";
import { PlatformSettings } from "@/lib/db/models";
import { logAdminAction } from "./admin/audit";

export type Settings = {
  /** Bank account for monthly plan payments; the IBAN is normalized (no spaces). */
  bankName: string;
  accountTitle: string;
  iban: string;
  paymentInstructions: string;
  sponsorshipInfo: string;
};

type SettingsLean = Partial<Record<keyof Settings, string | null>> | null;

const toSettings = (doc: SettingsLean): Settings => ({
  bankName: doc?.bankName ?? "",
  accountTitle: doc?.accountTitle ?? "",
  iban: doc?.iban ?? "",
  paymentInstructions: doc?.paymentInstructions ?? "",
  sponsorshipInfo: doc?.sponsorshipInfo ?? "",
});

const SETTINGS_TAG = "platform-settings";

/** Platform settings (defaults when never saved). Cached; updates invalidate the tag. */
export async function getPlatformSettings(): Promise<Settings> {
  "use cache";
  cacheLife("minutes");
  cacheTag(SETTINGS_TAG);
  await connectDB();
  return toSettings((await PlatformSettings.findById("platform").lean()) as SettingsLean);
}

export async function updatePlatformSettings(admin: SessionUser, patch: Partial<Settings>): Promise<Settings> {
  await connectDB();
  await PlatformSettings.updateOne({ _id: "platform" }, { $set: patch }, { upsert: true, runValidators: true });
  if (patch.bankName !== undefined || patch.accountTitle !== undefined || patch.iban !== undefined) {
    await logAdminAction(admin, "settings.bankAccount", "platform", null, [patch.bankName, patch.accountTitle, patch.iban].filter(Boolean).join(" · "));
  }
  if (patch.paymentInstructions !== undefined) await logAdminAction(admin, "settings.paymentInstructions", "platform", null);
  if (patch.sponsorshipInfo !== undefined) await logAdminAction(admin, "settings.sponsorshipInfo", "platform", null);
  revalidateTag(SETTINGS_TAG, { expire: 0 });
  return toSettings((await PlatformSettings.findById("platform").lean()) as SettingsLean);
}

/** Whether a shop's trial or paid plan is running, so it may be listed and take orders. */
export function hasActivePlan(shop: { subscription?: { endsAt?: Date | null } | null }, now: Date): boolean {
  return Boolean(shop.subscription?.endsAt && shop.subscription.endsAt > now);
}
