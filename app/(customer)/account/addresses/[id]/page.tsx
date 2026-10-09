import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AddressForm } from "@/components/customer/address-form";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { requireRole } from "@/lib/auth/session";
import { getAddress } from "@/lib/services/addresses";

export const metadata: Metadata = { title: "Edit address" };

export default function EditAddressPage({ params }: PageProps<"/account/addresses/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EditAddress params={params} />
    </Suspense>
  );
}

async function EditAddress({ params }: { params: PageProps<"/account/addresses/[id]">["params"] }) {
  const { id } = await params;
  const user = await requireRole(["customer"], `/account/addresses/${id}`);
  const address = await getAddress(user.id, id);
  if (!address) notFound();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/account/addresses" className="text-sm text-muted-foreground hover:text-foreground">
          ← Addresses
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{address.label}</h1>
      </div>
      <AddressForm address={address} />
    </div>
  );
}
