import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { formatPrice } from "@/lib/catalog";
import { PLANS } from "@/lib/plans";

export const metadata: Metadata = { title: "Subscriptions · Admin" };

export default function SubscriptionsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Subscriptions & payments</h1>
      <Suspense fallback={<PageSkeleton />}>
        <SubscriptionsContent />
      </Suspense>
    </div>
  );
}

async function SubscriptionsContent() {
  await requireRole(["admin"], "/admin/subscriptions");
  return (
    <>
      <Card className="flex flex-col gap-2 border-warning">
        <CardTitle>Billing isn&apos;t set up yet</CardTitle>
        <CardDescription>
          Shop subscriptions need a payment provider. Until one is chosen, verified shops are listed without a plan and
          there are no subscription payments to manage. Customer orders are paid in cash on delivery and are separate
          from subscription billing.
        </CardDescription>
      </Card>
      <Card className="flex flex-col gap-3">
        <CardTitle>Plans shown on the pricing page</CardTitle>
        <ul className="divide-y divide-border text-sm">
          {PLANS.map((p) => (
            <li key={p.id} className="flex justify-between gap-3 py-2">
              <span className="font-medium">{p.name}</span>
              <span>{formatPrice(p.monthlyPrice)} / month</span>
            </li>
          ))}
        </ul>
        <CardDescription>Defined in lib/plans.ts.</CardDescription>
      </Card>
    </>
  );
}
