// One-off migration to the "order by the can" model with a free trial, plus
// area-search text for every shop.
// Run once after deploying: npm run db:migrate
// Safe to run again: each step only touches shops that still need it.
//  1. Approved shops that never had a trial get one, starting now.
//  2. Shops copy their old 19L can (or cheapest can/refill) product price into
//     `pricePerCan`, if they don't have a price yet.
//  3. Removes leftover catalog fields from shops and the old platform switch.
//  4. Rebuilds every shop's `searchText` (name + address) for area search.
// The old `products` collection is left in place; drop it by hand once you're happy.
import mongoose from "mongoose";
import { connectDB } from "../lib/db/connect";
import { PlatformSettings, Shop } from "../lib/db/models";
import { TRIAL_DAYS, TRIAL_PLAN_ID } from "../lib/plans";
import { shopSearchText } from "../lib/search/text";

async function main() {
  await connectDB();
  const now = new Date();
  const db = mongoose.connection.db!;

  const trials = await Shop.updateMany(
    { status: "verified", trialStartedAt: null, $or: [{ subscription: null }, { "subscription.endsAt": { $lte: now } }] },
    { $set: { trialStartedAt: now, subscription: { planId: TRIAL_PLAN_ID, endsAt: new Date(now.getTime() + TRIAL_DAYS * 864e5) } } },
  );
  console.log(`Free trials started: ${trials.modifiedCount}`);

  let priced = 0;
  const unpriced = await Shop.find({ $or: [{ pricePerCan: null }, { pricePerCan: { $exists: false } }] }, { _id: 1 }).lean();
  for (const shop of unpriced) {
    const products = db.collection("products");
    const best =
      (await products.findOne({ shopId: shop._id, isActive: true, type: "can", sizeLiters: 19 }, { sort: { price: 1 } })) ??
      (await products.findOne({ shopId: shop._id, isActive: true, type: { $in: ["can", "refill"] } }, { sort: { price: 1 } }));
    if (best && typeof best.price === "number" && best.price > 0) {
      await Shop.updateOne({ _id: shop._id }, { $set: { pricePerCan: best.price } });
      priced++;
    }
  }
  console.log(`Prices copied from old products: ${priced} (shops still without a price: ${unpriced.length - priced})`);

  await db.collection("shops").updateMany({}, { $unset: { productTypes: "", minPrice: "" } });
  await PlatformSettings.collection.updateMany({}, { $unset: { requireSubscription: "" } });
  console.log("Removed old catalog fields and the 'require a plan' switch.");

  const all = await Shop.find({}, { name: 1, address: 1 }).lean();
  for (const shop of all) await Shop.updateOne({ _id: shop._id }, { $set: { searchText: shopSearchText(shop) } });
  console.log(`Search text rebuilt for ${all.length} shops.`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await mongoose.disconnect();
  process.exit(1);
});
