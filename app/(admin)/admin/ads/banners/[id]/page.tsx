import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminActions } from "@/components/admin/admin-actions";
import { BannerEditor } from "@/components/ads/banner-editor";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { getBannerForAdmin } from "@/lib/services/ads/banners";

export const metadata: Metadata = { title: "Banner · Admin" };

export default function EditBannerPage({ params }: PageProps<"/admin/ads/banners/[id]">) {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/ads?tab=banners" className="text-sm text-muted-foreground hover:text-foreground">
        ← Banners
      </Link>
      <Suspense fallback={<PageSkeleton />}>
        <EditBanner params={params} />
      </Suspense>
    </div>
  );
}

async function EditBanner({ params }: { params: PageProps<"/admin/ads/banners/[id]">["params"] }) {
  const { id } = await params;
  await requireRole(["admin"], `/admin/ads/banners/${id}`);
  const b = await getBannerForAdmin(id);
  if (!b) notFound();
  const rate = b.stats.impressions ? `${((b.stats.clicks / b.stats.impressions) * 100).toFixed(1)}%` : "—";

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">{b.title}</h1>
        <p className="text-sm text-muted-foreground">
          Last 30 days: {b.stats.impressions.toLocaleString("en")} shown · {b.stats.clicks.toLocaleString("en")} {b.stats.clicks === 1 ? "click" : "clicks"} · {rate} click rate
        </p>
      </div>
      <Card>
        <BannerEditor
          bannerId={b.id}
          initial={{
            title: b.title,
            subtitle: b.subtitle,
            ctaLabel: b.ctaLabel,
            sponsorName: b.sponsorName,
            linkUrl: b.linkUrl,
            imageId: b.imageId,
            videoId: b.videoId,
            startDate: b.startDate,
            endDate: b.endDate,
            isActive: b.isActive,
            sortOrder: b.sortOrder,
          }}
        />
      </Card>
      <Card className="flex flex-col gap-3 border-danger/40">
        <CardTitle>Delete banner</CardTitle>
        <CardDescription>Removes the banner and its image. To stop it for a while, untick “Show this banner” instead.</CardDescription>
        <AdminActions
          endpoint={`/api/admin/banners/${b.id}`}
          method="DELETE"
          redirectTo="/admin/ads?tab=banners"
          actions={[{ label: "Delete banner", body: {}, danger: true, confirm: `Delete “${b.title}”?` }]}
        />
      </Card>
    </>
  );
}
