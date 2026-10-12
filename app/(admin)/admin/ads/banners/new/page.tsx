import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BannerEditor } from "@/components/ads/banner-editor";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { Card } from "@/components/ui/card";
import { dayKey } from "@/lib/ads/dates";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New banner · Admin" };

export default function NewBannerPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/ads?tab=banners" className="text-sm text-muted-foreground hover:text-foreground">
          ← Banners
        </Link>
        <h1 className="mt-1 text-2xl font-bold">New banner</h1>
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <NewBanner />
      </Suspense>
    </div>
  );
}

function defaultDates() {
  const now = Date.now();
  return { today: dayKey(new Date(now)), inAWeek: dayKey(new Date(now + 6 * 24 * 60 * 60 * 1000)) };
}

async function NewBanner() {
  await requireRole(["admin"], "/admin/ads/banners/new");
  const { today, inAWeek } = defaultDates();
  return (
    <Card>
      <BannerEditor
        initial={{ title: "", subtitle: "", ctaLabel: "Learn more", sponsorName: "", linkUrl: "/shops", imageId: null, videoId: null, startDate: today, endDate: inAWeek, isActive: true, sortOrder: 0 }}
      />
    </Card>
  );
}
