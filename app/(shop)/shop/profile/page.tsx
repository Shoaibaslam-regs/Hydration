import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { ShopProfileForm } from "@/components/shopkeeper/shop-profile-form";
import { ShopStatusBanner } from "@/components/shopkeeper/shop-status-banner";
import { requireRole } from "@/lib/auth/session";
import { getMyShop } from "@/lib/services/my-shop";

export const metadata: Metadata = { title: "Shop profile" };

export default function ShopProfilePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProfileContent />
    </Suspense>
  );
}

async function ProfileContent() {
  const user = await requireRole(["shopkeeper"], "/shop/profile");
  const shop = await getMyShop(user.id);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{shop ? "Shop profile" : "Register your shop"}</h1>
        {!shop && (
          <p className="text-muted-foreground">
            After you submit, our team verifies your shop before it appears to customers.
          </p>
        )}
      </div>
      {shop && shop.status !== "verified" && <ShopStatusBanner shop={shop} />}
      {shop?.status === "suspended" ? null : <ShopProfileForm shop={shop} />}
    </div>
  );
}
