import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireRole } from "@/lib/auth/session";
import { MAX_ADDRESSES_PER_USER } from "@/lib/db/models/address";
import { listAddresses } from "@/lib/services/addresses";

export const metadata: Metadata = { title: "Addresses" };

export default function AddressesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AddressesContent />
    </Suspense>
  );
}

async function AddressesContent() {
  const user = await requireRole(["customer"], "/account/addresses");
  const addresses = await listAddresses(user.id);
  const canAdd = addresses.length < MAX_ADDRESSES_PER_USER;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Delivery addresses</h1>
        {canAdd && (
          <Link href="/account/addresses/new" className={buttonClasses()}>
            + Add address
          </Link>
        )}
      </div>
      {addresses.length === 0 ? (
        <EmptyState
          title="No saved addresses"
          description="Add where you'd like water delivered. You can save home, office and more."
          action={
            <Link href="/account/addresses/new" className={buttonClasses()}>
              Add your first address
            </Link>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id}>
              <Link href={`/account/addresses/${a.id}`} className="block h-full">
                <Card className="flex h-full flex-col gap-1 hover:border-primary">
                  <span className="flex items-center gap-2 font-semibold">
                    {a.label} {a.isDefault && <Badge tone="info">Default</Badge>}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {[a.line1, a.area, a.city].filter(Boolean).join(", ")}
                  </span>
                  {a.notes && <span className="text-sm text-muted-foreground">Note: {a.notes}</span>}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!canAdd && (
        <p className="text-sm text-muted-foreground">You&apos;ve saved the maximum of {MAX_ADDRESSES_PER_USER} addresses.</p>
      )}
    </div>
  );
}
