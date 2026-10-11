import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { SupportThreadView } from "@/components/support/support-views";

export const metadata: Metadata = { title: "Conversation · Contact Aqua" };

export default function SupportThreadPage({ params, searchParams }: PageProps<"/shop/support/[id]">) {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/shop/support" className="text-sm text-muted-foreground hover:text-foreground">
        ← All conversations
      </Link>
      <Suspense fallback={<PageSkeleton />}>
        <Thread params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Thread({ params, searchParams }: { params: PageProps<"/shop/support/[id]">["params"]; searchParams: PageProps<"/shop/support/[id]">["searchParams"] }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  return <SupportThreadView role="shopkeeper" id={id} justSent={sp.sent === "1"} />;
}
