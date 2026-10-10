import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminActions } from "@/components/admin/admin-actions";
import { CampaignRequestForm, DealForm } from "@/components/ads/shop-promote-forms";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { MAX_RUNNING_DEALS } from "@/lib/ads/constants";
import { dayKey } from "@/lib/ads/dates";
import { requireShopkeeperShop } from "@/lib/auth/shopkeeper";
import { formatDateTime, formatDayRange } from "@/lib/catalog";
import { listMyDeals } from "@/lib/services/ads/deals";
import { adTotals } from "@/lib/services/ads/stats";
import { listMyCampaigns, sponsorshipStatus } from "@/lib/services/ads/sponsored";
import { getPlatformSettings } from "@/lib/services/platform-settings";

export const metadata: Metadata = { title: "Promote your shop" };

const CAMPAIGN_LABELS = {
  pending: ["Waiting for review", "warning"],
  approved: ["Approved", "success"],
  rejected: ["Not approved", "danger"],
  cancelled: ["Cancelled", "neutral"],
} as const;

export default function PromotePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Promote your shop</h1>
      <Suspense fallback={<PageSkeleton />}>
        <PromoteContent />
      </Suspense>
    </div>
  );
}

async function PromoteContent() {
  const { shop } = await requireShopkeeperShop("/shop/promote");
  const [status, campaigns, deals, settings, stats] = await Promise.all([
    sponsorshipStatus(shop.id),
    listMyCampaigns(shop),
    listMyDeals(shop),
    getPlatformSettings(),
    adTotals("sponsored", [shop.id], 30),
  ]);
  const sponsoredNow = status.viaPlan || status.viaCampaign;
  const pendingRequest = campaigns.some((c) => c.status === "pending");
  const runningDeals = deals.filter((d) => d.state === "running");
  const s = stats.get(shop.id) ?? { impressions: 0, clicks: 0 };
  const approved = shop.status === "verified";

  return (
    <>
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Sponsored placement</CardTitle>
            <CardDescription>
              Appear at the top of search, marked “Sponsored”, for customers your shop delivers to.
            </CardDescription>
          </div>
          <Badge tone={sponsoredNow ? "success" : "neutral"}>{sponsoredNow ? "Sponsored now" : "Not sponsored"}</Badge>
        </div>

        {status.viaPlan && <p className="text-sm">Included with your Pro plan while it&apos;s active.</p>}

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-muted p-3">
            <dt className="text-xs text-muted-foreground">Shown (30 days)</dt>
            <dd className="text-xl font-semibold">{s.impressions.toLocaleString("en")}</dd>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <dt className="text-xs text-muted-foreground">Clicks (30 days)</dt>
            <dd className="text-xl font-semibold">{s.clicks.toLocaleString("en")}</dd>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <dt className="text-xs text-muted-foreground">Click rate</dt>
            <dd className="text-xl font-semibold">{s.impressions ? `${((s.clicks / s.impressions) * 100).toFixed(1)}%` : "—"}</dd>
          </div>
        </dl>

        {!approved ? (
          <CardDescription>Sponsorship is available once your shop is approved.</CardDescription>
        ) : pendingRequest ? (
          <CardDescription>Your request is waiting for review. We&apos;ll approve it once your payment is confirmed.</CardDescription>
        ) : (
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <p className="text-sm font-medium">Request a sponsored campaign</p>
            <div className="rounded-lg border border-border p-3 text-sm">
              {settings.sponsorshipInfo ? (
                <p className="whitespace-pre-line text-muted-foreground">{settings.sponsorshipInfo}</p>
              ) : (
                <p className="text-muted-foreground">Contact the Aqua team for sponsorship prices.</p>
              )}
            </div>
            <CampaignRequestForm today={dayKey(new Date())} />
          </div>
        )}

        {campaigns.length > 0 && (
          <ul className="divide-y divide-border border-t border-border text-sm">
            {campaigns.map((c) => {
              const [label, tone] = CAMPAIGN_LABELS[c.status];
              return (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <span className="flex flex-col">
                    <span className="font-medium">
                      {formatDayRange(c.startsAt, c.endsAt)}
                    </span>
                    {c.reviewReason && <span className="text-xs text-muted-foreground">{c.reviewReason}</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge tone={c.running ? "success" : tone}>{c.running ? "Running" : label}</Badge>
                    {c.status === "pending" && (
                      <AdminActions
                        endpoint={`/api/shopkeeper/campaigns/${c.id}`}
                        method="DELETE"
                        actions={[{ label: "Withdraw", body: {}, danger: true, confirm: "Withdraw this request?" }]}
                      />
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <div>
          <CardTitle>Deals</CardTitle>
          <CardDescription>
            Free. Deals show on your shop page, on your card in search with a “Deal” tag, and in “Latest deals” on the home
            page. Up to {MAX_RUNNING_DEALS} at once.
          </CardDescription>
        </div>
        {!approved && <CardDescription>Customers will see your deals once your shop is approved.</CardDescription>}
        {runningDeals.length < MAX_RUNNING_DEALS ? (
          <DealForm />
        ) : (
          <CardDescription>You&apos;re running {MAX_RUNNING_DEALS} deals. End one to post another.</CardDescription>
        )}
        {deals.length > 0 && (
          <ul className="divide-y divide-border border-t border-border text-sm">
            {deals.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">{d.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {d.state === "running" ? `Until ${formatDateTime(d.endsAt)}` : d.state === "ended" ? `Ended ${formatDateTime(d.endsAt)}` : d.removedBy === "admin" ? `Removed by Aqua: ${d.removedReason}` : "Ended early"}
                  </span>
                </span>
                {d.state === "running" ? (
                  <AdminActions
                    endpoint={`/api/shopkeeper/deals/${d.id}`}
                    method="DELETE"
                    actions={[{ label: "End now", body: {}, danger: true, confirm: `End “${d.title}” now?` }]}
                  />
                ) : (
                  <Badge tone={d.state === "removed" && d.removedBy === "admin" ? "danger" : "neutral"}>
                    {d.state === "removed" ? (d.removedBy === "admin" ? "Removed" : "Ended") : "Ended"}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
