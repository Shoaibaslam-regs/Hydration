import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentForm } from "@/components/billing/payment-form";
import { PaymentStatusBadge } from "@/components/billing/payment-status-badge";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { DeleteButton } from "@/components/ui/delete-button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireShopkeeperShop } from "@/lib/auth/shopkeeper";
import { PAYMENT_METHOD_LABELS } from "@/lib/billing/constants";
import { formatDateTime, formatPrice } from "@/lib/catalog";
import { PLANS, TRIAL_DAYS } from "@/lib/plans";
import { getMyBilling } from "@/lib/services/billing";
import { getPlatformSettings } from "@/lib/services/platform-settings";

export const metadata: Metadata = { title: "Billing" };

export default function BillingPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Billing</h1>
      <Suspense fallback={<PageSkeleton />}>
        <BillingContent />
      </Suspense>
    </div>
  );
}

async function BillingContent() {
  const { shop } = await requireShopkeeperShop("/shop/billing");
  const [{ subscription, payments }, settings] = await Promise.all([getMyBilling(shop), getPlatformSettings()]);
  const waiting = payments.find((p) => p.status === "pending");
  const lastRejected = payments[0]?.status === "rejected" ? payments[0] : null;

  return (
    <>
      <Card className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Your plan</CardTitle>
          {subscription ? (
            <Badge tone={subscription.active ? "success" : "danger"}>
              {subscription.active ? (subscription.isTrial ? "Free trial" : "Active") : "Ended"}
            </Badge>
          ) : (
            <Badge>Trial not started</Badge>
          )}
        </div>
        {subscription ? (
          <p className="text-sm">
            <span className="font-medium">{subscription.planName}</span> ·{" "}
            {subscription.active ? (subscription.isTrial ? "ends " : "paid until ") : "ended "}
            {formatDateTime(subscription.endsAt)}
          </p>
        ) : (
          <CardDescription>Your {TRIAL_DAYS}-day free trial starts when our team approves your shop.</CardDescription>
        )}
        <CardDescription>
          Your shop appears in search and takes orders while your free trial or paid plan is running. After the trial, the plan
          is {formatPrice(PLANS[0].monthlyPrice)} a month. Paying during the trial adds the months after it ends.
        </CardDescription>
      </Card>

      {waiting ? (
        <Card className="flex flex-col gap-1 border-warning">
          <CardTitle>Payment waiting for review</CardTitle>
          <CardDescription>
            {waiting.planName} × {waiting.months} {waiting.months === 1 ? "month" : "months"} · {formatPrice(waiting.amount)} ·{" "}
            {PAYMENT_METHOD_LABELS[waiting.method]} ref. {waiting.reference}. Sent {formatDateTime(waiting.createdAt)}. We&apos;ll
            activate your plan once we&apos;ve confirmed it.
          </CardDescription>
          <DeleteButton
            endpoint={`/api/shopkeeper/billing/${waiting.id}`}
            variant="link"
            label="Made a mistake? Cancel this payment"
            confirmTitle="Cancel this payment?"
            confirmMessage="It won't be reviewed. You can send a new one with the right details."
            confirmLabel="Cancel payment"
            className="mt-1"
          />
        </Card>
      ) : (
        <Card className="flex flex-col gap-4">
          <div>
            <CardTitle>{subscription?.active && !subscription.isTrial ? "Renew your plan" : `Pay for the monthly plan`}</CardTitle>
            <CardDescription>Pay using the details below, then send us the transaction ID so we can confirm it.</CardDescription>
          </div>
          {lastRejected && (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm">
              Your last payment (ref. {lastRejected.reference}) wasn&apos;t approved: {lastRejected.reviewReason}
            </p>
          )}
          <div className="rounded-lg border border-border p-3 text-sm">
            <p className="mb-1 font-medium">How to pay</p>
            {settings.paymentInstructions ? (
              <p className="whitespace-pre-line text-muted-foreground">{settings.paymentInstructions}</p>
            ) : (
              <p className="text-muted-foreground">Payment details haven&apos;t been published yet. Please contact the Aqua team.</p>
            )}
          </div>
          <PaymentForm />
          <p className="text-xs text-muted-foreground">Included: {PLANS[0].features.join(", ")}.</p>
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <CardTitle>Payment history</CardTitle>
        {payments.length === 0 ? (
          <CardDescription>No payments yet.</CardDescription>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="flex flex-col">
                  <span className="font-medium">
                    {p.planName} × {p.months} {p.months === 1 ? "month" : "months"} · {formatPrice(p.amount)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {PAYMENT_METHOD_LABELS[p.method]} ref. {p.reference} · sent {formatDateTime(p.createdAt)}
                    {p.periodEnd && ` · covers until ${formatDateTime(p.periodEnd)}`}
                  </span>
                  {p.status === "rejected" && p.reviewReason && (
                    <span className="text-xs text-danger">Reason: {p.reviewReason}</span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  <PaymentStatusBadge status={p.status} />
                  {(p.status === "pending" || p.status === "rejected") && (
                    <DeleteButton
                      endpoint={`/api/shopkeeper/billing/${p.id}`}
                      variant="icon"
                      label={p.status === "pending" ? "Cancel this payment" : "Delete this payment"}
                      confirmTitle={p.status === "pending" ? "Cancel this payment?" : "Delete this rejected payment?"}
                      confirmMessage={
                        p.status === "pending"
                          ? `Ref. ${p.reference} won't be reviewed. If you already paid, send it again with the right details.`
                          : `Ref. ${p.reference} is removed from your history.`
                      }
                      confirmLabel={p.status === "pending" ? "Cancel payment" : "Delete"}
                    />
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
