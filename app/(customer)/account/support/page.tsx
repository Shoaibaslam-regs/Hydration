import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { SupportInbox } from "@/components/support/support-views";

export const metadata: Metadata = { title: "Contact Aqua" };

export default function SupportPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Contact the Aqua team</h1>
        <p className="text-muted-foreground">A problem with an order, a shop or your account? Send us a message and we&apos;ll reply here.</p>
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <SupportInbox role="customer" />
      </Suspense>
    </div>
  );
}
