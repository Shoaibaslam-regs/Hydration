import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminActions } from "@/components/admin/admin-actions";
import { AuditLog } from "@/components/admin/audit-log";
import { PaymentStatusBadge } from "@/components/billing/payment-status-badge";
import { SettingsForm } from "@/components/billing/settings-form";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { Pagination } from "@/components/ui/pagination";
import { requireRole } from "@/lib/auth/session";
import { PAYMENT_METHOD_LABELS, type SubscriptionPaymentStatus } from "@/lib/billing/constants";
import { formatDateTime, formatPrice } from "@/lib/catalog";
import { listAdminActions } from "@/lib/services/admin/audit";
import { countShopsWithoutActivePlan, listSubscriptionPayments } from "@/lib/services/billing";
import { getPlatformSettings } from "@/lib/services/platform-settings";
import { adminPaymentListSchema } from "@/lib/validation/billing";

export const metadata: Metadata = { title: "Subscriptions · Admin" };

const TABS: { status: SubscriptionPaymentStatus; label: string }[] = [
  { status: "pending", label: "Waiting for review" },
  { status: "approved", label: "Approved" },
  { status: "rejected", label: "Rejected" },
];

export default function SubscriptionsPage({ searchParams }: PageProps<"/admin/subscriptions">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Subscriptions & payments</h1>
      <Suspense fallback={<PageSkeleton />}>
        <SubscriptionsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SubscriptionsContent({ searchParams }: { searchParams: PageProps<"/admin/subscriptions">["searchParams"] }) {
  await requireRole(["admin"], "/admin/subscriptions");
  const parsed = adminPaymentListSchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : adminPaymentListSchema.parse({});
  const status = query.status ?? "pending";
  const [settings, withoutPlan, payments, history] = await Promise.all([
    getPlatformSettings(),
    countShopsWithoutActivePlan(),
    listSubscriptionPayments({ ...query, status }),
    listAdminActions("platform", null, 10),
  ]);

  return (
    <>
      <Card className="flex flex-col gap-3">
        <CardTitle>Settings</CardTitle>
        <SettingsForm
          requireSubscription={settings.requireSubscription}
          paymentInstructions={settings.paymentInstructions}
          shopsWithoutPlan={withoutPlan}
        />
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Payments</h2>
        <FilterTabs
          label="Filter payments"
          tabs={TABS.map((t) => ({ label: t.label, href: `/admin/subscriptions?status=${t.status}`, active: t.status === status }))}
        />
        {payments.items.length === 0 ? (
          <EmptyState title={status === "pending" ? "No payments waiting for review" : "No payments here yet"} />
        ) : (
          <ul className="flex flex-col gap-3">
            {payments.items.map((p) => (
              <li key={p.id}>
                <Card className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <Link href={`/admin/shops/${p.shopId}`} className="font-semibold text-primary hover:underline">
                        {p.shopName}
                      </Link>
                      <span className="text-sm">
                        {p.planName} × {p.months} {p.months === 1 ? "month" : "months"} ·{" "}
                        <span className="font-semibold">{formatPrice(p.amount)}</span>
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {PAYMENT_METHOD_LABELS[p.method]} · ref. <span className="font-mono">{p.reference}</span> · sent{" "}
                        {formatDateTime(p.createdAt)}
                      </span>
                      {p.note && <span className="text-sm text-muted-foreground">Note: {p.note}</span>}
                      {p.periodEnd && (
                        <span className="text-xs text-muted-foreground">
                          Covers {formatDateTime(p.periodStart!)} – {formatDateTime(p.periodEnd)}
                        </span>
                      )}
                      {p.reviewReason && <span className="text-xs text-danger">Reason: {p.reviewReason}</span>}
                    </div>
                    <PaymentStatusBadge status={p.status} />
                  </div>
                  {p.status === "pending" && (
                    <AdminActions
                      endpoint={`/api/admin/subscription-payments/${p.id}`}
                      reasonHint="Shown to the shopkeeper on their billing page."
                      actions={[
                        {
                          label: "Approve",
                          body: { decision: "approve" },
                          confirm: `Confirm you received ${formatPrice(p.amount)} (ref. ${p.reference})? This activates ${p.planName} for ${p.months} ${p.months === 1 ? "month" : "months"}.`,
                        },
                        { label: "Reject", body: { decision: "reject" }, needsReason: true, danger: true },
                      ]}
                    />
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
        <Pagination page={payments.page} totalPages={payments.totalPages} hrefFor={(pg) => `/admin/subscriptions?status=${status}&page=${pg}`} />
      </section>

      {history.length > 0 && <AuditLog entries={history} />}
      <CardDescription>Plans and prices are defined in lib/plans.ts and shown on the public pricing page.</CardDescription>
    </>
  );
}
