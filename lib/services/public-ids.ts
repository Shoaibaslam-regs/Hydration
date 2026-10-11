import "server-only";
import { connectDB } from "@/lib/db/connect";
import { Shop, User } from "@/lib/db/models";
import { generatePublicId } from "@/lib/ids";

const DUPLICATE_KEY = 11000;

/**
 * Give a public ID to every account and shop created before IDs existed.
 * New records get one automatically (pre-validate hooks). Safe to run again.
 */
export async function backfillPublicIds(): Promise<{ users: number; shops: number }> {
  await connectDB();
  const missing = { $or: [{ publicId: { $exists: false } }, { publicId: null }, { publicId: "" }] };
  let users = 0;
  for (const u of await User.find(missing, { role: 1 }).lean()) {
    if (await assign(() => User.updateOne({ _id: u._id, ...missing }, { $set: { publicId: generatePublicId(u.role as "customer") } }))) users++;
  }
  let shops = 0;
  for (const s of await Shop.find(missing, { _id: 1 }).lean()) {
    if (await assign(() => Shop.updateOne({ _id: s._id, ...missing }, { $set: { publicId: generatePublicId("shop") } }))) shops++;
  }
  return { users, shops };
}

/** Retries with a fresh ID on the (very unlikely) collision. */
async function assign(update: () => Promise<{ modifiedCount: number }>): Promise<boolean> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return (await update()).modifiedCount > 0;
    } catch (err) {
      if ((err as { code?: number }).code !== DUPLICATE_KEY) throw err;
    }
  }
  return false;
}
