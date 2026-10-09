import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AddressForm } from "@/components/customer/address-form";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Add address" };

export default function NewAddressPage({ searchParams }: PageProps<"/account/addresses/new">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewAddress searchParams={searchParams} />
    </Suspense>
  );
}

async function NewAddress({ searchParams }: { searchParams: PageProps<"/account/addresses/new">["searchParams"] }) {
  await requireRole(["customer"], "/account/addresses/new");
  const next = (await searchParams).next;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/account/addresses" className="text-sm text-muted-foreground hover:text-foreground">
          ← Addresses
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Add address</h1>
      </div>
      <AddressForm address={null} next={typeof next === "string" ? next : null} />
    </div>
  );
}
