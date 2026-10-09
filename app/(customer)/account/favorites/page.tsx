import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { ShopCard } from "@/components/shops/shop-card";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireRole } from "@/lib/auth/session";
import { listFavoriteShops } from "@/lib/services/favorites";

export const metadata: Metadata = { title: "Saved shops" };

export default function FavoritesPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Saved shops</h1>
      <Suspense fallback={<PageSkeleton />}>
        <Favorites />
      </Suspense>
    </div>
  );
}

async function Favorites() {
  const user = await requireRole(["customer"], "/account/favorites");
  const shops = await listFavoriteShops(user.id);
  if (shops.length === 0) {
    return (
      <EmptyState
        title="No saved shops yet"
        description="Tap “Save shop” on a shop's page to find it here quickly."
        action={<Link href="/shops" className={buttonClasses()}>Find shops</Link>}
      />
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {shops.map((s) => (
        <ShopCard key={s.id} shop={s} />
      ))}
    </div>
  );
}
