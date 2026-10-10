import { Types } from "mongoose";
import type { UserRole } from "@/lib/auth/roles";
import type { SessionUser } from "@/lib/auth/session";
import type { ShopStatus } from "@/lib/db/models/shop";
import { Address, Order, Shop, User } from "@/lib/db/models";
import { shopSearchText } from "@/lib/search/text";
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
  overrides: Partial<{
    status: ShopStatus;
    deliveryRadiusKm: number;
    deliveryFee: number;
    location: { lat: number; lng: number };
    name: string;
    /** Minor units; null = not set. Default PKR 250. */
    pricePerCan: number | null;
    /** Plan end; null = no plan. Default: a paid plan running for 30 more days. */
    planEndsAt: Date | null;
    address: { line1: string; area: string; city: string };
  }> = {},
): Promise<MyShop> {
  const loc = overrides.location ?? HOME;
  const name = overrides.name ?? `Shop ${uniq()}`;
  const address = overrides.address ?? { line1: "1 Test Rd", area: "Gulberg", city: "Lahore" };
  await Shop.create({
    ownerId: owner.id,
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    phone: "+92 300 0000000",
    address,
    location: { type: "Point", coordinates: [loc.lng, loc.lat] },
    deliveryRadiusKm: overrides.deliveryRadiusKm ?? 5,
    deliveryFee: overrides.deliveryFee ?? 5_000,
    status: overrides.status ?? "verified",
    searchText: shopSearchText({ name, address }),
    pricePerCan: overrides.pricePerCan === undefined ? 25_000 : overrides.pricePerCan,
    subscription:
      overrides.planEndsAt === null ? null : { planId: "monthly", endsAt: overrides.planEndsAt ?? new Date(Date.now() + 30 * 864e5) },
  });
  return (await getMyShop(owner.id))!;
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

/** An order's current status, straight from the database. */
export async function statusOf(orderId: string): Promise<string | undefined> {
  return (await Order.findById(new Types.ObjectId(orderId), { status: 1 }).lean())?.status;
}

/** A new customer (with an address) orders `quantity` cans from `shop`. */
export async function placeTestOrder(shop: MyShop, quantity = 1, customer?: SessionUser) {
  const { placeOrder } = await import("@/lib/services/customer-orders");
  const buyer = customer ?? (await createUser("customer"));
  const addressId = await createAddress(buyer);
  const { id } = await placeOrder(buyer, { shopSlug: shop.slug, quantity, addressId, contactPhone: "+92 301 0000000", notes: "" });
  return { id, customer: buyer, addressId };
}
