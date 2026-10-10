import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminActions, type AdminAction } from "@/components/admin/admin-actions";
import { SponsorshipInfoForm } from "@/components/ads/sponsorship-info-form";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { Pagination } from "@/components/ui/pagination";
import { SPONSORED_SLOTS, type CampaignStatus } from "@/lib/ads/constants";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime, formatDayRange } from "@/lib/catalog";
import { listBannersForAdmin } from "@/lib/services/ads/banners";
import { listDealsForAdmin } from "@/lib/services/ads/deals";
import { listCampaignsForAdmin } from "@/lib/services/ads/sponsored";
import { getPlatformSettings } from "@/lib/services/platform-settings";
import { adminAdsQuerySchema } from "@/lib/validation/ads";

export const metadata: Metadata = { title: "Ads · Admin" };

type Query = ReturnType<typeof adminAdsQuerySchema.parse>;

const CAMPAIGN_TABS: { status: CampaignStatus; label: string }[] = [
  { status: "pending", label: "Waiting for review" },
  { status: "approved", label: "Approved" },
  { status: "rejected", label: "Rejected" },
  { status: "cancelled", label: "Cancelled" },
];

const BANNER_STATES = {
  running: ["Showing", "success"],
  scheduled: ["Scheduled", "info"],
  ended: ["Ended", "neutral"],
  off: ["Paused", "warning"],
} as const;

function hrefFor(over: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(over)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const s = qs.toString();
  return s ? `/admin/ads?${s}` : "/admin/ads";
}

const ctr = (s: { impressions: number; clicks: number }) => (s.impressions ? `${((s.clicks / s.impressions) * 100).toFixed(1)}%` : "—");

export default function AdminAdsPage({ searchParams }: PageProps<"/admin/ads">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Ads</h1>
      <Suspense fallback={<PageSkeleton />}>
        <AdsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function AdsContent({ searchParams }: { searchParams: PageProps<"/admin/ads">["searchParams"] }) {
  await requireRole(["admin"], "/admin/ads");
  const parsed = adminAdsQuerySchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : adminAdsQuerySchema.parse({});

  return (
    <>
      <FilterTabs
        label="Ad type"
        tabs={[
          { label: "Sponsored", href: hrefFor({ tab: "sponsored" }), active: query.tab === "sponsored" },
          { label: "Deals", href: hrefFor({ tab: "deals" }), active: query.tab === "deals" },
          { label: "Home banners", href: hrefFor({ tab: "banners" }), active: query.tab === "banners" },
        ]}
      />
      {query.tab === "sponsored" && <SponsoredTab query={query} />}
      {query.tab === "deals" && <DealsTab query={query} />}
      {query.tab === "banners" && <BannersTab />}
    </>
  );
}

async function SponsoredTab({ query }: { query: Query }) {
  const status = query.status ?? "pending";
  const [settings, result] = await Promise.all([getPlatformSettings(), listCampaignsForAdmin({ ...query, status })]);

  return (
    <>
      <Card className="flex flex-col gap-3">
        <CardTitle>How sponsorship works</CardTitle>
        <CardDescription>
          Up to {SPONSORED_SLOTS} sponsored shops show above page 1 of a located search, picked at random from shops that match the
          customer&apos;s filters and deliver to them. Shops on the Pro plan are included automatically. Others request a campaign,
          pay you outside the site, and you approve it here.
        </CardDescription>
        <SponsorshipInfoForm initial={settings.sponsorshipInfo} />
      </Card>

      <FilterTabs
        label="Campaign status"
        tabs={CAMPAIGN_TABS.map((t) => ({ label: t.label, href: hrefFor({ tab: "sponsored", status: t.status }), active: status === t.status }))}
      />
      {result.items.length === 0 ? (
        <EmptyState title={status === "pending" ? "No requests waiting" : "Nothing here"} />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-border">
            {result.items.map((c) => {
              const actions: AdminAction[] =
                c.status === "pending"
                  ? [
                      { label: "Approve", body: { decision: "approve" }, confirm: `Approve ${c.shopName}'s campaign? Only do this once you've received the payment.` },
                      { label: "Reject", body: { decision: "reject" }, needsReason: true, danger: true },
                    ]
                  : c.status === "approved" && new Date(c.endsAt) > new Date()
                    ? [{ label: "Cancel campaign", body: { decision: "cancel" }, needsReason: true, danger: true }]
                    : [];
              return (
                <li key={c.id} className="flex flex-col gap-3 px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="flex min-w-0 flex-col">
                      <Link href={`/admin/shops/${c.shopId}`} className="font-medium text-primary hover:underline">
                        {c.shopName}
                      </Link>
                      <span className="text-sm">
                        {formatDayRange(c.startsAt, c.endsAt)}
                      </span>
                      <span className="text-xs text-muted-foreground">Requested {formatDateTime(c.createdAt)}</span>
                      {c.note && <span className="text-sm text-muted-foreground">Note: {c.note}</span>}
                      {c.reviewReason && <span className="text-sm text-muted-foreground">Reason: {c.reviewReason}</span>}
                    </span>
                    {c.running && <Badge tone="success">Running</Badge>}
                  </div>
                  <AdminActions endpoint={`/api/admin/campaigns/${c.id}`} actions={actions} reasonHint="The shopkeeper sees this." />
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <Pagination page={result.page} totalPages={result.totalPages} hrefFor={(p) => hrefFor({ tab: "sponsored", status, page: p })} />
    </>
  );
}

async function DealsTab({ query }: { query: Query }) {
  const result = await listDealsForAdmin({ ...query, state: query.dealState });
  return (
    <>
      <FilterTabs
        label="Deal state"
        tabs={[
          { label: "Running", href: hrefFor({ tab: "deals" }), active: query.dealState === "running" },
          { label: "All", href: hrefFor({ tab: "deals", dealState: "all" }), active: query.dealState === "all" },
        ]}
      />
      {result.items.length === 0 ? (
        <EmptyState title="No deals" />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-border">
            {result.items.map((d) => (
              <li key={d.id} className="flex flex-col gap-3 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{d.title}</span>
                    {d.description && <span className="text-sm text-muted-foreground">{d.description}</span>}
                    <span className="text-xs text-muted-foreground">
                      {d.shop ? (
                        <Link href={`/admin/shops/${d.shop.id}`} className="text-primary hover:underline">
                          {d.shop.name}
                        </Link>
                      ) : (
                        "Deleted shop"
                      )}{" "}
                      · posted {formatDateTime(d.createdAt)} · {d.state === "running" ? "until" : "ended"} {formatDateTime(d.endsAt)}
                    </span>
                    {d.removedBy === "admin" && <span className="text-xs text-muted-foreground">Removed: {d.removedReason}</span>}
                  </span>
                  <Badge tone={d.state === "running" ? "success" : d.removedBy === "admin" ? "danger" : "neutral"}>
                    {d.state === "running" ? "Running" : d.removedBy === "admin" ? "Removed" : "Ended"}
                  </Badge>
                </div>
                {d.state === "running" && (
                  <AdminActions
                    endpoint={`/api/admin/deals/${d.id}`}
                    method="DELETE"
                    actions={[{ label: "Remove deal", body: {}, needsReason: true, danger: true }]}
                    reasonHint="The shopkeeper sees this."
                  />
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Pagination page={result.page} totalPages={result.totalPages} hrefFor={(p) => hrefFor({ tab: "deals", dealState: query.dealState, page: p })} />
    </>
  );
}

async function BannersTab() {
  const banners = await listBannersForAdmin();
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">
          Banners rotate at the top of the home page, marked “Promoted”. Use them for your own announcements or for space you sell
          to brands. Numbers cover the last 30 days.
        </p>
        <Link href="/admin/ads/banners/new" className={buttonClasses({})}>
          New banner
        </Link>
      </div>
      {banners.length === 0 ? (
        <EmptyState title="No banners yet" />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-border">
            {banners.map((b) => {
              const [label, tone] = BANNER_STATES[b.state];
              return (
                <li key={b.id}>
                  <Link href={`/admin/ads/banners/${b.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-muted/50">
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium">{b.title}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {b.startDate} → {b.endDate} · {b.linkUrl}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {b.stats.impressions.toLocaleString("en")} shown · {b.stats.clicks.toLocaleString("en")} {b.stats.clicks === 1 ? "click" : "clicks"} · {ctr(b.stats)}
                      </span>
                    </span>
                    <Badge tone={tone}>{label}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
