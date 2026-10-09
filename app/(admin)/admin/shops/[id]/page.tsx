import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminActions } from "@/components/admin/admin-actions";
import { AuditLog } from "@/components/admin/audit-log";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { LocationMap } from "@/components/map/location-map";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import {
  ADMIN_SHOP_ACTION_LABELS,
  ADMIN_SHOP_TRANSITIONS,
  SHOP_REASON_REQUIRED,
  SHOP_STATUS_LABELS,
  SHOP_STATUS_TONES,
} from "@/lib/admin/shop-status";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime, formatPrice } from "@/lib/catalog";
import { getAdminShop } from "@/lib/services/admin/shops";

export const metadata: Metadata = { title: "Shop · Admin" };

export default function AdminShopPage({ params }: PageProps<"/admin/shops/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ShopDetail params={params} />
    </Suspense>
  );
}

async function ShopDetail({ params }: { params: PageProps<"/admin/shops/[id]">["params"] }) {
  const { id } = await params;
  await requireRole(["admin"], `/admin/shops/${id}`);
  const shop = await getAdminShop(id);
  if (!shop) notFound();

  const actions = ADMIN_SHOP_TRANSITIONS[shop.status].map((to) => ({
    label: shop.status === "suspended" && to === "verified" ? "Reinstate" : ADMIN_SHOP_ACTION_LABELS[to],
    body: { status: to },
    needsReason: SHOP_REASON_REQUIRED.includes(to),
    danger: SHOP_REASON_REQUIRED.includes(to),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/shops" className="text-sm text-muted-foreground hover:text-foreground">
          ← Shops
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{shop.name}</h1>
          <Badge tone={SHOP_STATUS_TONES[shop.status]}>{SHOP_STATUS_LABELS[shop.status]}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Registered {formatDateTime(shop.createdAt)}
          {shop.verifiedAt && ` · verified ${formatDateTime(shop.verifiedAt)}`}
          {shop.status === "verified" && (
            <>
              {" · "}
              <Link href={`/shops/${shop.slug}`} className="text-primary hover:underline">
                public page
              </Link>
            </>
          )}
        </p>
      </div>

      {shop.statusReason && (
        <Card className="border-danger/40 text-sm">
          <span className="font-medium">Reason shown to shopkeeper:</span> {shop.statusReason}
        </Card>
      )}
      {shop.ownerStatus === "suspended" && shop.status === "verified" && (
        <Card className="border-warning text-sm">
          The owner&apos;s account is suspended, but this shop is still live. Suspend the shop too if customers
          shouldn&apos;t order from it.
        </Card>
      )}

      {actions.length > 0 && (
        <Card className="flex flex-col gap-3">
          <CardTitle>Verification</CardTitle>
          <AdminActions
            endpoint={`/api/admin/shops/${shop.id}`}
            actions={actions}
            reasonHint="The shopkeeper sees this reason on their dashboard."
          />
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-col gap-3 text-sm">
          <CardTitle>Details</CardTitle>
          {shop.description && <p className="text-muted-foreground">{shop.description}</p>}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="text-muted-foreground">Owner</dt>
            <dd>
              {shop.owner ? (
                <Link href={`/admin/users/${shop.owner.id}`} className="text-primary hover:underline">
                  {shop.owner.name} · {shop.owner.email}
                </Link>
              ) : (
                "—"
              )}
            </dd>
            <dt className="text-muted-foreground">Phone</dt>
            <dd>{shop.phone}</dd>
            <dt className="text-muted-foreground">Address</dt>
            <dd>{[shop.addressLine1, shop.area, shop.city].filter(Boolean).join(", ")}</dd>
            <dt className="text-muted-foreground">Delivery</dt>
            <dd>
              Within {shop.deliveryRadiusKm} km · {shop.deliveryFee === 0 ? "free" : formatPrice(shop.deliveryFee)}
            </dd>
            <dt className="text-muted-foreground">Hours</dt>
            <dd>
              {shop.hours.opensAt}–{shop.hours.closesAt}
            </dd>
            <dt className="text-muted-foreground">Products</dt>
            <dd>{shop.productCount}</dd>
            <dt className="text-muted-foreground">Orders</dt>
            <dd>
              <Link href={`/admin/orders?shopId=${shop.id}`} className="text-primary hover:underline">
                {shop.orderCount}
              </Link>
            </dd>
            <dt className="text-muted-foreground">Rating</dt>
            <dd>{shop.rating.count ? `${shop.rating.average.toFixed(1)} ★ (${shop.rating.count})` : "No reviews"}</dd>
          </dl>
        </Card>
        <Card className="flex flex-col gap-3">
          <CardTitle>Location</CardTitle>
          <LocationMap value={shop.location} label={`Map showing ${shop.name}`} />
          <p className="text-xs text-muted-foreground">
            {shop.location.lat.toFixed(5)}, {shop.location.lng.toFixed(5)}
          </p>
        </Card>
      </div>

      <AuditLog entries={shop.history} />
    </div>
  );
}
