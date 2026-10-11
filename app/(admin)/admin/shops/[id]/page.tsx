import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminActions } from "@/components/admin/admin-actions";
import { AuditLog } from "@/components/admin/audit-log";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { LocationMap } from "@/components/map/location-map";
import { StarShopBadge } from "@/components/shops/star-badge";
import { VerifiedBadge } from "@/components/shops/verified-badge";
import { AdminMessageForm } from "@/components/support/admin-message-form";
import { IdChip } from "@/components/ui/id-chip";
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
import { listShopReviewsForAdmin } from "@/lib/services/reviews";

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
  const [shop, reviews] = await Promise.all([getAdminShop(id), listShopReviewsForAdmin(id)]);
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
          {shop.hasVerifiedBadge && <VerifiedBadge />}
          {shop.hasStarAward && <StarShopBadge />}
          <IdChip id={shop.publicId} />
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
          <CardTitle>Approval</CardTitle>
          <AdminActions
            endpoint={`/api/admin/shops/${shop.id}`}
            actions={actions}
            reasonHint="The shopkeeper sees this reason on their dashboard."
          />
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Verified badge</CardTitle>
          {shop.hasVerifiedBadge ? <VerifiedBadge /> : <Badge>Not given</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          {shop.badgeGrantedAt
            ? `Given ${formatDateTime(shop.badgeGrantedAt)}. Customers see the ✓ Verified mark next to this shop's name.`
            : "A trust mark customers see next to the shop's name, for shops the Aqua team has checked further (e.g. visited or confirmed their licence). Separate from approval: every listed shop is approved."}
        </p>
        <AdminActions
          endpoint={`/api/admin/shops/${shop.id}/badge`}
          method="POST"
          reasonHint={shop.hasVerifiedBadge ? "Kept in the admin history." : "Optional: what was checked. Kept in the admin history."}
          actions={
            shop.hasVerifiedBadge
              ? [{ label: "Remove badge", body: { action: "revoke" }, needsReason: true, danger: true }]
              : [{ label: "Give verified badge", body: { action: "grant" } }]
          }
        />
      </Card>

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Star shop award</CardTitle>
          {shop.hasStarAward ? <StarShopBadge /> : <Badge>Not given</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          {shop.starGrantedAt
            ? `Given ${formatDateTime(shop.starGrantedAt)}. Everyone sees the ★ Star shop mark on this shop's card and page.`
            : "Reward an outstanding shop. Everyone sees a ★ Star shop mark on its card and page, and the shopkeeper gets a congratulations message in their Contact Aqua inbox."}
        </p>
        {shop.hasStarAward ? (
          <AdminActions
            endpoint={`/api/admin/shops/${shop.id}/star`}
            method="POST"
            reasonHint="Kept in the admin history."
            actions={[{ label: "Remove award", body: { action: "revoke" }, needsReason: true, danger: true }]}
          />
        ) : (
          <AdminActions
            endpoint={`/api/admin/shops/${shop.id}/star`}
            method="POST"
            reasonKey="message"
            reasonHint="Optional: a personal note for the shopkeeper. Leave it empty to send the standard congratulations."
            actions={[
              { label: "★ Make Star shop", body: { action: "grant" }, needsReason: true, reasonOptional: true, reasonLabel: "Note to the shopkeeper" },
            ]}
          />
        )}
      </Card>

      {shop.owner && (
        <Card className="flex flex-col gap-3">
          <CardTitle>Message the shopkeeper</CardTitle>
          <AdminMessageForm userId={shop.owner.id} role="shopkeeper" name={shop.owner.name} />
        </Card>
      )}

      {shop.status === "verified" && (
        <Card className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Availability</CardTitle>
            <Badge tone={shop.closure ? "danger" : "success"}>{shop.closure ? "Closed" : "Open"}</Badge>
          </div>
          {shop.closure && (
            <p className="text-sm text-muted-foreground">
              Closed by {shop.closure.by === "admin" ? "an admin" : "the shopkeeper"} on {formatDateTime(shop.closure.at)}
              {shop.closure.reason && <> — “{shop.closure.reason}”</>}.
              {shop.closure.by === "shopkeeper" && " Closing it as admin stops the shopkeeper from reopening it."}
            </p>
          )}
          <AdminActions
            endpoint={`/api/admin/shops/${shop.id}/closure`}
            method="POST"
            reasonHint="Shown to the shopkeeper. Customers only see that the shop is closed."
            actions={[
              ...(shop.closure ? [{ label: "Reopen shop", body: { action: "reopen" } }] : []),
              ...(shop.closure?.by === "admin" ? [] : [{ label: "Close shop", body: { action: "close" }, needsReason: true, danger: true }]),
            ]}
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
                <span className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/users/${shop.owner.id}`} className="text-primary hover:underline">
                    {shop.owner.name} · {shop.owner.email}
                  </Link>
                  <IdChip id={shop.owner.publicId} />
                </span>
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
            <dt className="text-muted-foreground">Price per can</dt>
            <dd>{shop.pricePerCan ? formatPrice(shop.pricePerCan) : <span className="text-danger">Not set (hidden from search)</span>}</dd>
            <dt className="text-muted-foreground">Orders</dt>
            <dd>
              <Link href={`/admin/orders/shops/${shop.id}`} className="text-primary hover:underline">
                {shop.orderCount}
              </Link>
            </dd>
            <dt className="text-muted-foreground">Plan</dt>
            <dd>
              {shop.plan ? (
                <span className={shop.plan.active ? undefined : "text-danger"}>
                  {shop.plan.planName} · {shop.plan.active ? "until" : "ended"} {formatDateTime(shop.plan.endsAt)}
                </span>
              ) : (
                "Trial starts on approval"
              )}
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

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <CardTitle>Reviews</CardTitle>
          <span className="text-sm text-muted-foreground">
            {shop.rating.count ? `${shop.rating.average.toFixed(1)} ★ from ${shop.rating.count}` : "No reviews"}
          </span>
        </div>
        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reviews yet.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {reviews.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="font-medium">{r.authorName}</span>{" "}
                    <span className="text-warning" aria-label={`${r.rating} out of 5 stars`}>
                      {"★".repeat(r.rating)}
                    </span>
                    <span className="text-muted-foreground"> · {formatDateTime(r.createdAt)}</span>
                    {r.comment && <span className="block break-words">{r.comment}</span>}
                  </span>
                </div>
                <AdminActions
                  endpoint={`/api/admin/reviews/${r.id}`}
                  method="DELETE"
                  actions={[{ label: "Delete review", body: {}, needsReason: true, danger: true }]}
                  reasonHint="Kept in the admin history. The shop's rating is recalculated."
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <AuditLog entries={shop.history} target={{ type: "shop", id: shop.id }} />

      <Card className="flex flex-col gap-3 border-danger/40">
        <CardTitle>Danger zone</CardTitle>
        <p className="text-sm text-muted-foreground">
          Removing the shop deletes it with its reviews and saved-shop links, and cancels any
          unfinished orders. Past orders stay in customers&apos; history. The shopkeeper&apos;s account is kept. This can&apos;t be
          undone. To hide the shop for a while instead, close it.
        </p>
        <AdminActions
          endpoint={`/api/admin/shops/${shop.id}`}
          method="DELETE"
          redirectTo="/admin/shops"
          reasonHint="Kept in the admin history and shown to customers on cancelled orders."
          actions={[
            {
              label: "Remove shop permanently",
              body: {},
              needsReason: true,
              danger: true,
              confirm: `Permanently remove "${shop.name}"? This can't be undone.`,
            },
          ]}
        />
      </Card>
    </div>
  );
}
