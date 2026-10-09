import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { ProductForm } from "@/components/shopkeeper/product-form";
import { requireShopkeeperShop } from "@/lib/auth/shopkeeper";
import { getMyProduct } from "@/lib/services/my-products";

export const metadata: Metadata = { title: "Edit product" };

export default function EditProductPage({ params }: PageProps<"/shop/products/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EditProduct params={params} />
    </Suspense>
  );
}

async function EditProduct({ params }: { params: PageProps<"/shop/products/[id]">["params"] }) {
  const { id } = await params;
  const { shop } = await requireShopkeeperShop(`/shop/products/${id}`);
  const product = await getMyProduct(shop, id);
  if (!product) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/shop/products" className="text-sm text-muted-foreground hover:text-foreground">
          ← Products
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{product.name}</h1>
      </div>
      <ProductForm product={product} />
    </div>
  );
}
