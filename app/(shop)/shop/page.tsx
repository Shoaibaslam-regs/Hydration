import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SponsorPlanCard } from "@/components/ads/shop-promote-forms";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { ShopAvailability } from "@/components/shopkeeper/shop-availability";
import { ShopStatusBanner } from "@/components/shopkeeper/shop-status-banner";
import { NewSupportThreadForm } from "@/components/support/new-thread-form";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { IdChip } from "@/components/ui/id-chip";
import { StarCustomerBadge, StarShopBadge } from "@/components/shops/star-badge";
import { requireRole } from "@/lib/auth/session";
import { isShopLocked } from "@/lib/billing/lock";
import { formatDateTime, formatDayRange, formatPrice } from "@/lib/catalog";
import { listMyCampaigns } from "@/lib/services/ads/sponsored";
import { getPlatformSettings } from "@/lib/services/platform-settings";
import { getMyShop, getMyShopStats } from "@/lib/services/my-shop";
import { PLANS, TRIAL_DAYS } from "@/lib/plans";
import { getMyBilling } from "@/lib/services/billing";
import { listShopOrders } from "@/lib/services/shop-orders";
import { getProfile } from "@/lib/services/users";

export const metadata: Metadata = { title: "Shop dashboard" };

export default function ShopDashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ShopOverview />
    </Suspense>
  );
}

async function ShopOverview() {
  const user = await requireRole(["shopkeeper"], "/shop");
  const shop = await getMyShop(user.id);
  if (shop && isShopLocked(shop)) redirect("/shop/billing?locked=1");

  if (!shop) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Welcome, {user.name.split(" ")[0]}</h1>
        <Card className="flex flex-col items-start gap-3">
          <CardTitle>Register your shop</CardTitle>
          <CardDescription>
            Add your shop&apos;s details and location. After our team approves it, customers nearby can find you and
            place orders.
          </CardDescription>
          <Link href="/shop/profile" className={buttonClasses()}>
            Register your shop
          </Link>
        </Card>
      </div>
    );
  }

  const [stats, recent, billing, profile, campaigns, settings] = await Promise.all([
    getMyShopStats(shop.id),
    listShopOrders(shop, { page: 1, limit: 5 }),
    getMyBilling(shop),
    getProfile(user.id),
    listMyCampaigns(shop),
    getPlatformSettings(),
  ]);
  const running = campaigns.find((c) => c.running);
  const pendingSponsor = campaigns.some((c) => c.status === "pending");
  const plan = billing.subscription;

  const tiles = [
    { label: "New orders", value: stats.newOrders, href: "/shop/orders?status=pending", alert: stats.newOrders > 0 },
    { label: "In progress", value: stats.activeOrders, href: "/shop/orders" },
    { label: "Delivered (30 days)", value: stats.deliveredLast30Days, href: "/shop/reports" },
    {
      label: "Price per can",
      value: shop.pricePerCan ? formatPrice(shop.pricePerCan) : "Not set",
      href: "/shop/profile",
      alert: !shop.pricePerCan,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-2xl font-bold">{shop.name}</h1>
        <IdChip id={shop.publicId} label="Your Shop ID" />
        <IdChip id={profile?.publicId ?? ""} label="Your Shopkeeper ID" />
        {shop.hasStarAward && <StarShopBadge />}
      </div>
      <ShopStatusBanner shop={shop} />
      {shop.status === "verified" && <ShopAvailability shop={shop} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="group">
            <Card className={t.alert ? "border-warning" : "group-hover:border-primary"}>
              <p className="text-sm text-muted-foreground">{t.label}</p>
              <p className="mt-1 text-2xl font-bold sm:text-3xl">{t.value}</p>
            </Card>
          </Link>
        ))}
      </div>

      {shop.status === "verified" &&
        (running ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-premium/50 bg-premium-soft px-4 py-3 text-sm">
            <span>
              <span className="font-semibold text-premium">★ Sponsored</span> · your shop is at the top of search ({formatDayRange(running.startsAt, running.endsAt)}).
            </span>
            <Link href="/shop/promote" className="font-medium text-primary hover:underline">
              Views &amp; clicks
            </Link>
          </div>
        ) : pendingSponsor ? (
          <div className="rounded-xl border border-premium/50 bg-premium-soft px-4 py-3 text-sm">
            <span className="font-semibold text-premium">★ Sponsored plan requested.</span> The Aqua team will start it once your payment
            is confirmed. Follow up in{" "}
            <Link href="/shop/support" className="font-medium text-primary hover:underline">
              Contact Aqua
            </Link>
            .
          </div>
        ) : (
          <SponsorPlanCard paymentInfo={settings.sponsorshipInfo} compact />
        ))}

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <CardTitle>Recent orders</CardTitle>
          <Link href="/shop/orders" className="text-sm font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
        {recent.items.length === 0 ? (
          <CardDescription>No orders yet. They&apos;ll show up here as customers order from you.</CardDescription>
        ) : (
          <ul className="divide-y divide-border">
            {recent.items.map((o) => (
              <li key={o.id}>
                <Link href={`/shop/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:text-primary">
                  <span className="flex flex-col">
                    <span className="font-medium">{o.orderNumber}</span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                      {o.contactName} · {formatDateTime(o.createdAt)}
                      <IdChip id={o.customerPublicId} />
                      {o.isStarCustomer && <StarCustomerBadge />}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-medium">{formatPrice(o.total)}</span>
                    <OrderStatusBadge status={o.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Plan</CardTitle>
          <CardDescription>
            {!plan
              ? `Your ${TRIAL_DAYS}-day free trial starts when your shop is approved.`
              : plan.isTrial
                ? `Free trial · ${plan.active ? "ends" : "ended"} ${formatDateTime(plan.endsAt)}`
                : `${plan.planName} · ${plan.active ? "paid until" : "ended"} ${formatDateTime(plan.endsAt)}`}
          </CardDescription>
        </div>
        <Link href="/shop/billing" className={buttonClasses({ variant: plan?.active && !plan.isTrial ? "secondary" : "primary", size: "sm" })}>
          {plan?.active && !plan.isTrial ? "Billing" : `Pay ${formatPrice(PLANS[0].monthlyPrice)}/month`}
        </Link>
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Contact the Aqua team</CardTitle>
            <CardDescription>Stuck with a payment, an order or your listing? Send us a message and we&apos;ll reply in “Contact with team”.</CardDescription>
          </div>
          <Link href="/shop/support" className="text-sm font-medium text-primary hover:underline">
            Your conversations →
          </Link>
        </div>
        <NewSupportThreadForm role="shopkeeper" compact />
      </Card>
    </div>
  );
}
