import "server-only";
import { revalidateTag } from "next/cache";
import { Types } from "mongoose";
import { ApiError } from "@/lib/api/errors";
import { LOW_STOCK_THRESHOLD, toMinorUnits, type ProductType } from "@/lib/catalog";
import { connectDB } from "@/lib/db/connect";
import { Product } from "@/lib/db/models";
import { paginated, skipFor, type Paginated } from "@/lib/validation/pagination";
import type { ProductInput, ProductListQuery, ProductUpdate } from "@/lib/validation/shopkeeper";
import { refreshShopCatalogSummary } from "./catalog";
import type { MyShop } from "./my-shop";
import { shopTag } from "./shops";

export type MyProduct = {
  id: string;
  name: string;
  type: ProductType;
  description: string;
  sizeLiters: number | null;
  /** Minor currency units. */
  price: number;
  stock: number;
  isActive: boolean;
};

type ProductLean = {
  _id: Types.ObjectId;
  name: string;
  type: string;
  description?: string | null;
  sizeLiters?: number | null;
  price: number;
  stock?: number | null;
  isActive?: boolean | null;
};

function toMyProduct(p: ProductLean): MyProduct {
  return {
    id: p._id.toString(),
    name: p.name,
    type: p.type as ProductType,
    description: p.description ?? "",
    sizeLiters: p.sizeLiters ?? null,
    price: p.price,
    stock: p.stock ?? 0,
    isActive: p.isActive ?? true,
  };
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** After any product change: refresh the shop's search summary and its cached public page. */
async function afterCatalogChange(shop: MyShop) {
  await refreshShopCatalogSummary(shop.id);
  revalidateTag(shopTag(shop.slug), { expire: 0 });
}

export async function listMyProducts(shop: MyShop, query: ProductListQuery): Promise<Paginated<MyProduct>> {
  await connectDB();
  const filter: Record<string, unknown> = { shopId: new Types.ObjectId(shop.id) };
  if (query.q) filter.name = new RegExp(escapeRegex(query.q), "i");
  if (query.stock === "out") filter.stock = 0;
  if (query.stock === "low") filter.stock = { $lte: LOW_STOCK_THRESHOLD };

  const [items, total] = await Promise.all([
    Product.find(filter).sort({ isActive: -1, name: 1, _id: 1 }).skip(skipFor(query)).limit(query.limit).lean(),
    Product.countDocuments(filter),
  ]);
  return paginated(items.map((p) => toMyProduct(p as unknown as ProductLean)), total, query);
}

export async function getMyProduct(shop: MyShop, productId: string): Promise<MyProduct | null> {
  if (!Types.ObjectId.isValid(productId)) return null;
  await connectDB();
  const p = await Product.findOne({ _id: productId, shopId: shop.id }).lean();
  return p ? toMyProduct(p as unknown as ProductLean) : null;
}

export async function createMyProduct(shop: MyShop, input: ProductInput): Promise<MyProduct> {
  await connectDB();
  const p = await Product.create({
    ...input,
    sizeLiters: input.sizeLiters ?? undefined,
    price: toMinorUnits(input.price),
    shopId: shop.id,
  });
  await afterCatalogChange(shop);
  return toMyProduct(p.toObject() as unknown as ProductLean);
}

export async function updateMyProduct(shop: MyShop, productId: string, input: ProductUpdate): Promise<MyProduct> {
  await connectDB();
  const $set: Record<string, unknown> = { ...input };
  const $unset: Record<string, 1> = {};
  if (input.price !== undefined) $set.price = toMinorUnits(input.price);
  if (input.sizeLiters === null) {
    delete $set.sizeLiters;
    $unset.sizeLiters = 1;
  }
  const p = await Product.findOneAndUpdate(
    { _id: productId, shopId: shop.id },
    { $set, ...(Object.keys($unset).length ? { $unset } : {}) },
    { new: true, runValidators: true },
  ).lean();
  if (!p) throw ApiError.notFound("Product not found");
  await afterCatalogChange(shop);
  return toMyProduct(p as unknown as ProductLean);
}

/** Past orders keep their own copy of product details, so deleting is safe. */
export async function deleteMyProduct(shop: MyShop, productId: string): Promise<void> {
  await connectDB();
  const res = await Product.deleteOne({ _id: productId, shopId: shop.id });
  if (res.deletedCount === 0) throw ApiError.notFound("Product not found");
  await afterCatalogChange(shop);
}
