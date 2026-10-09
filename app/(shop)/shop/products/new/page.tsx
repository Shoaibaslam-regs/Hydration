import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { ProductForm } from "@/components/shopkeeper/product-form";
import { requireShopkeeperShop } from "@/lib/auth/shopkeeper";

export const metadata: Metadata = { title: "Add product" };

export default function NewProductPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewProduct />
    </Suspense>
  );
}

async function NewProduct() {
  await requireShopkeeperShop("/shop/products/new");
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/shop/products" className="text-sm text-muted-foreground hover:text-foreground">
          ← Products
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Add product</h1>
      </div>
      <ProductForm product={null} />
    </div>
  );
}
