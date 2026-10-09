import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/dashboard/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { requireShopkeeperShop } from "@/lib/auth/shopkeeper";
import { formatPrice, LOW_STOCK_THRESHOLD, PRODUCT_TYPE_LABELS } from "@/lib/catalog";
import { listMyProducts } from "@/lib/services/my-products";
import { productListQuerySchema } from "@/lib/validation/shopkeeper";

export const metadata: Metadata = { title: "Products" };

export default function ProductsPage({ searchParams }: PageProps<"/shop/products">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProductsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ProductsContent({ searchParams }: { searchParams: PageProps<"/shop/products">["searchParams"] }) {
  const { shop } = await requireShopkeeperShop("/shop/products");
  const raw = await searchParams;
  const parsed = productListQuerySchema.safeParse(raw);
  const query = parsed.success ? parsed.data : productListQuerySchema.parse({});
  const result = await listMyProducts(shop, query);
  const filtered = Boolean(query.q || query.stock);

  const hrefFor = (page: number) => {
    const qs = new URLSearchParams();
    if (query.q) qs.set("q", query.q);
    if (query.stock) qs.set("stock", query.stock);
    qs.set("page", String(page));
    return `/shop/products?${qs}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Products</h1>
        <Link href="/shop/products/new" className={buttonClasses()}>
          + Add product
        </Link>
      </div>

      {/* Plain GET form: filters live in the URL and the list is rendered on the server. */}
      <form className="flex flex-col gap-2 sm:flex-row" action="/shop/products">
        <Input name="q" type="search" placeholder="Search products" defaultValue={query.q ?? ""} aria-label="Search products" />
        <Select name="stock" defaultValue={query.stock ?? ""} aria-label="Stock filter" className="sm:w-48">
          <option value="">All stock levels</option>
          <option value="low">Low stock (≤ {LOW_STOCK_THRESHOLD})</option>
          <option value="out">Out of stock</option>
        </Select>
        <button type="submit" className={buttonClasses({ variant: "secondary" })}>
          Filter
        </button>
      </form>

      {result.items.length === 0 ? (
        <EmptyState
          title={filtered ? "No matching products" : "No products yet"}
          description={filtered ? "Try a different search or filter." : "Add the water products you sell so customers can order them."}
          action={
            !filtered && (
              <Link href="/shop/products/new" className={buttonClasses()}>
                Add your first product
              </Link>
            )
          }
        />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-border">
            {result.items.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/shop/products/${p.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-muted/50"
                >
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="truncate font-medium">{p.name}</span>
                    <span className="flex flex-wrap gap-1.5">
                      <Badge tone="info">{PRODUCT_TYPE_LABELS[p.type]}</Badge>
                      {p.sizeLiters !== null && <Badge>{p.sizeLiters} L</Badge>}
                      {!p.isActive && <Badge>Hidden</Badge>}
                    </span>
                  </span>
                  <span className="flex items-center gap-4 text-sm">
                    <span className="font-semibold">{formatPrice(p.price)}</span>
                    <Badge tone={p.stock === 0 ? "danger" : p.stock <= LOW_STOCK_THRESHOLD ? "warning" : "success"}>
                      {p.stock === 0 ? "Out of stock" : `${p.stock} in stock`}
                    </Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Pagination page={result.page} totalPages={result.totalPages} hrefFor={hrefFor} />
    </div>
  );
}
