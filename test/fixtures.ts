import { Types } from "mongoose";
import type { UserRole } from "@/lib/auth/roles";
import type { SessionUser } from "@/lib/auth/session";
import type { ProductType } from "@/lib/catalog";
import type { ShopStatus } from "@/lib/db/models/shop";
import { Address, Product, Shop, User } from "@/lib/db/models";
import { refreshShopCatalogSummary } from "@/lib/services/catalog";
import { getMyShop, type MyShop } from "@/lib/services/my-shop";

let n = 0;
const uniq = () => `${Date.now().toString(36)}${(n++).toString(36)}`;

export const HOME = { lat: 31.52, lng: 74.35 };

export async function createUser(role: UserRole = "customer", name = "Test User"): Promise<SessionUser> {
  const u = await User.create({ name, email: `${role}-${uniq()}@t.test`, passwordHash: "x", role });
  return { id: u._id.toString(), name: u.name, email: u.email, role };
}

export async function createShop(
  owner: SessionUser,
  overrides: Partial<{ status: ShopStatus; deliveryRadiusKm: number; deliveryFee: number; location: { lat: number; lng: number }; name: string }> = {},
): Promise<MyShop> {
  const loc = overrides.location ?? HOME;
  const name = overrides.name ?? `Shop ${uniq()}`;
  await Shop.create({
    ownerId: owner.id,
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    phone: "+92 300 0000000",
    address: { line1: "1 Test Rd", area: "Gulberg", city: "Lahore" },
    location: { type: "Point", coordinates: [loc.lng, loc.lat] },
    deliveryRadiusKm: overrides.deliveryRadiusKm ?? 5,
    deliveryFee: overrides.deliveryFee ?? 5_000,
    status: overrides.status ?? "verified",
  });
  return (await getMyShop(owner.id))!;
}

export async function createProduct(shop: MyShop, overrides: Partial<{ name: string; type: ProductType; price: number; stock: number; isActive: boolean }> = {}) {
  const p = await Product.create({
    shopId: shop.id,
    name: overrides.name ?? `Product ${uniq()}`,
    type: overrides.type ?? "can",
    price: overrides.price ?? 25_000,
    stock: overrides.stock ?? 10,
    isActive: overrides.isActive ?? true,
  });
  await refreshShopCatalogSummary(shop.id);
  return p._id.toString();
}

export async function createAddress(user: SessionUser, loc = { lat: 31.53, lng: 74.36 }) {
  const a = await Address.create({
    userId: user.id,
    label: "Home",
    line1: "5 Canal View",
    city: "Lahore",
    location: { type: "Point", coordinates: [loc.lng, loc.lat] },
    isDefault: true,
  });
  return a._id.toString();
}

export async function stockOf(productId: string): Promise<number> {
  return (await Product.findById(new Types.ObjectId(productId), { stock: 1 }).lean())!.stock;
}
