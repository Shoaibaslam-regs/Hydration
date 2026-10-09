import "server-only";
import { USER_ROLES, type UserRole } from "@/lib/auth/roles";
import { connectDB } from "@/lib/db/connect";
import { Shop, User } from "@/lib/db/models";
import { SHOP_STATUSES, type ShopStatus } from "@/lib/db/models/shop";

export type PlatformCounts = {
  users: Record<UserRole, number>;
  shops: Record<ShopStatus, number>;
};

async function countBy<K extends string>(
  model: typeof User | typeof Shop,
  field: string,
  keys: readonly K[],
): Promise<Record<K, number>> {
  const rows = await (model as typeof User).aggregate<{ _id: K; n: number }>([
    { $group: { _id: `$${field}`, n: { $sum: 1 } } },
  ]);
  const out = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  for (const row of rows) if (keys.includes(row._id)) out[row._id] = row.n;
  return out;
}

/** Headline counts for the admin overview. Callers must enforce the admin role. */
export async function getPlatformCounts(): Promise<PlatformCounts> {
  await connectDB();
  const [users, shops] = await Promise.all([
    countBy(User, "role", USER_ROLES),
    countBy(Shop, "status", SHOP_STATUSES),
  ]);
  return { users, shops };
}
