import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentForm } from "@/components/billing/payment-form";
import { PaymentStatusBadge } from "@/components/billing/payment-status-badge";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { DeleteButton } from "@/components/ui/delete-button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireShopkeeperShop } from "@/lib/auth/shopkeeper";
import { formatIban } from "@/lib/billing/iban";
import { isShopLocked } from "@/lib/billing/lock";
import type { Settings } from "@/lib/services/platform-settings";
import { CopyButton } from "@/components/ui/copy-button";
import { IdChip } from "@/components/ui/id-chip";
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
  const { shop } = await requireShopkeeperShop("/shop/billing", { allowLocked: true });
  const [{ subscription, payments }, settings] = await Promise.all([getMyBilling(shop), getPlatformSettings()]);
  const waiting = payments.find((p) => p.status === "pending");
  const lastRejected = payments[0]?.status === "rejected" ? payments[0] : null;
  const locked = isShopLocked(shop);

  return (
    <>
      {locked && (
        <div role="alert" className="flex flex-col gap-1 rounded-xl border-2 border-danger/50 bg-danger/10 p-4">
          <p className="flex items-center gap-2 text-lg font-bold text-danger">
            <LockIcon /> Your shop is locked
          </p>
          <p className="text-sm">
            {subscription
              ? `Your ${subscription.isTrial ? "free trial" : "plan"} ended ${formatDateTime(subscription.endsAt)}.`
              : "Your shop doesn't have a plan yet."}{" "}
            Customers can&apos;t find your shop or order from it, and your dashboard is locked until your monthly fee of{" "}
            <span className="font-semibold">{formatPrice(PLANS[0].monthlyPrice)}</span> is paid.
          </p>
          <p className="text-sm text-muted-foreground">
            {waiting
              ? "We have your payment. Your shop unlocks as soon as the Aqua team confirms it."
              : "Pay to the account below, then send us the transaction ID. Your shop unlocks as soon as we confirm it."}
          </p>
        </div>
      )}
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
          <PayTo settings={settings} shopPublicId={shop.publicId} />
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

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/** Where to send the monthly fee: the bank account (IBAN) with copy buttons, then any other ways to pay. */
function PayTo({ settings, shopPublicId }: { settings: Settings; shopPublicId: string }) {
  const hasBank = Boolean(settings.iban);
  if (!hasBank && !settings.paymentInstructions) {
    return (
      <p className="rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
        Payment details haven&apos;t been published yet. Please message the Aqua team from Contact Aqua and we&apos;ll send them to you.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {hasBank && (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-gradient-to-br from-accent/60 via-card to-card p-4">
          <p className="text-sm font-semibold">Bank transfer</p>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {settings.bankName && (
              <div>
                <dt className="text-xs text-muted-foreground">Bank</dt>
                <dd className="font-medium">{settings.bankName}</dd>
              </div>
            )}
            {settings.accountTitle && (
              <div>
                <dt className="text-xs text-muted-foreground">Account title</dt>
                <dd className="flex flex-wrap items-center gap-2 font-medium">
                  {settings.accountTitle}
                  <CopyButton value={settings.accountTitle} label="account title" />
                </dd>
              </div>
            )}
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">IBAN</dt>
              <dd className="flex flex-wrap items-center gap-2">
                <span className="select-all font-mono text-base font-bold tracking-wider sm:text-lg">{formatIban(settings.iban)}</span>
                <CopyButton value={settings.iban} label="IBAN" />
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Amount</dt>
              <dd className="font-semibold">{formatPrice(PLANS[0].monthlyPrice)} per month</dd>
            </div>
          </dl>
          {shopPublicId && (
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              Put your Shop ID in the transfer reference so we can match it: <IdChip id={shopPublicId} label={false} />
            </p>
          )}
        </div>
      )}
      {settings.paymentInstructions && (
        <div className="rounded-lg border border-border p-3 text-sm">
          <p className="mb-1 font-medium">{hasBank ? "Other ways to pay" : "How to pay"}</p>
          <p className="whitespace-pre-line text-muted-foreground">{settings.paymentInstructions}</p>
        </div>
      )}
    </div>
  );
}
