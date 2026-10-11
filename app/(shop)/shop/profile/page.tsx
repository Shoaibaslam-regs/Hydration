import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { DeleteAccount } from "@/components/account/delete-account";
import { DeleteShop } from "@/components/shopkeeper/delete-shop";
import { ShopProfileForm } from "@/components/shopkeeper/shop-profile-form";
import { ShopStatusBanner } from "@/components/shopkeeper/shop-status-banner";
import { IdChip } from "@/components/ui/id-chip";
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
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {shop && <IdChip id={shop.publicId} label="Your Shop ID" />}
          <IdChip id={user.publicId ?? ""} label="Your Shopkeeper ID" />
        </div>
        {shop && (
          <p className="mt-1 text-xs text-muted-foreground">
            Mention these IDs when you contact the Aqua team. Customers&apos; IDs appear on their orders.
          </p>
        )}
        {!shop && (
          <p className="text-muted-foreground">
            After you submit, our team reviews and approves your shop before it appears to customers.
          </p>
        )}
      </div>
      {shop && shop.status !== "verified" && <ShopStatusBanner shop={shop} />}
      {shop?.status === "suspended" ? null : <ShopProfileForm shop={shop} />}
      {shop && <DeleteShop shopName={shop.name} />}
      <DeleteAccount role="shopkeeper" />
    </div>
  );
}
