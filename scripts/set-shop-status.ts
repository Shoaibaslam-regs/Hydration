// Set a shop's verification status until the admin UI exists (Phase 5).
// Usage: npm run shop:set-status -- --slug my-shop --status verified [--reason "..."]
import mongoose from "mongoose";
import { connectDB } from "../lib/db/connect";
import { Shop } from "../lib/db/models";
import { SHOP_STATUSES, type ShopStatus } from "../lib/db/models/shop";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const slug = arg("slug");
  const status = arg("status") as ShopStatus | undefined;
  if (!slug || !status || !SHOP_STATUSES.includes(status)) {
    throw new Error(`Usage: --slug <slug> --status <${SHOP_STATUSES.join("|")}> [--reason "..."]`);
  }
  await connectDB();
  const res = await Shop.updateOne(
    { slug },
    {
      $set: {
        status,
        statusReason: arg("reason") ?? "",
        ...(status === "verified" ? { verifiedAt: new Date() } : {}),
      },
    },
  );
  if (res.matchedCount === 0) throw new Error(`No shop with slug "${slug}"`);
  console.log(`Shop "${slug}" is now ${status}.`);
  // This script runs outside Next.js, so it can't invalidate the cached public page.
  console.log("Note: the public shop page may take up to a minute to reflect this.");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
