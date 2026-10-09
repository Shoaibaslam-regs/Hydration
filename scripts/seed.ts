// Seeds demo shops + products around a point, for local development.
// Usage: npm run db:seed -- --lat 31.5204 --lng 74.3587
// Re-running replaces previous demo data (shops with slugs starting "demo-").
import mongoose, { Types } from "mongoose";
import { PRODUCT_TYPES, type ProductType } from "../lib/catalog";
import { connectDB } from "../lib/db/connect";
import { Product, Shop } from "../lib/db/models";
import { refreshShopCatalogSummary } from "../lib/services/catalog";

const NAMES = [
  "Blue Spring Water", "Crystal Drops", "Pure Flow", "Fresh Aqua Point", "Clear Stream",
  "Mountain Fresh", "Rain Drop Water", "Pristine Water Co", "Oasis Refills", "Hydro Hub",
  "Glacier Water", "Spring Valley",
];
const AREAS = ["North", "South", "East", "West", "Central", "Old Town"];

const PRODUCT_TEMPLATES: { name: string; type: ProductType; sizeLiters: number; basePrice: number }[] = [
  { name: "Mineral water bottle", type: "bottle", sizeLiters: 1.5, basePrice: 80 },
  { name: "Mineral water bottle (6-pack)", type: "bottle", sizeLiters: 9, basePrice: 450 },
  { name: "19L water can", type: "can", sizeLiters: 19, basePrice: 250 },
  { name: "12L water can", type: "can", sizeLiters: 12, basePrice: 180 },
  { name: "19L can refill", type: "refill", sizeLiters: 19, basePrice: 120 },
  { name: "Table-top dispenser", type: "dispenser", sizeLiters: 0, basePrice: 3500 },
];

// Deterministic PRNG so seeds are reproducible.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function arg(name: string): number | undefined {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(v) ? v : undefined;
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed in production");
  const lat = arg("lat");
  const lng = arg("lng");
  if (lat === undefined || lng === undefined) {
    throw new Error("Pass a center point: npm run db:seed -- --lat <latitude> --lng <longitude>");
  }

  await connectDB();
  const rand = rng(42);

  const old = await Shop.find({ slug: /^demo-/ }, { _id: 1 }).lean();
  await Product.deleteMany({ shopId: { $in: old.map((s) => s._id) } });
  await Shop.deleteMany({ _id: { $in: old.map((s) => s._id) } });

  for (const [i, name] of NAMES.entries()) {
    // Scatter within ~8 km of the center.
    const r = 8 * Math.sqrt(rand());
    const theta = 2 * Math.PI * rand();
    const dLat = (r * Math.cos(theta)) / 111;
    const dLng = (r * Math.sin(theta)) / (111 * Math.cos((lat * Math.PI) / 180));

    const shop = await Shop.create({
      ownerId: new Types.ObjectId(),
      name,
      slug: `demo-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      description: `${name} delivers clean, filtered drinking water to homes and offices nearby.`,
      phone: `+00 300 000 ${String(1000 + i)}`,
      address: { line1: `${10 + i} Demo Street`, area: AREAS[i % AREAS.length], city: "Demo City" },
      location: { type: "Point", coordinates: [lng + dLng, lat + dLat] },
      deliveryRadiusKm: 3 + Math.floor(rand() * 8),
      deliveryFee: rand() < 0.3 ? 0 : (2 + Math.floor(rand() * 6)) * 1000,
      hours: { opensAt: rand() < 0.5 ? "08:00" : "09:00", closesAt: rand() < 0.5 ? "21:00" : "23:00" },
      // One pending shop to confirm unverified shops stay hidden.
      status: i === NAMES.length - 1 ? "pending" : "verified",
      rating: { average: Math.round((3 + rand() * 2) * 10) / 10, count: Math.floor(rand() * 200) },
    });

    const products = PRODUCT_TEMPLATES.filter(() => rand() < 0.7);
    await Product.insertMany(
      (products.length ? products : PRODUCT_TEMPLATES.slice(0, 2)).map((p) => ({
        shopId: shop._id,
        name: p.name,
        type: p.type,
        sizeLiters: p.sizeLiters || undefined,
        price: Math.round(p.basePrice * (0.85 + rand() * 0.3)) * 100,
        stock: rand() < 0.15 ? 0 : Math.floor(rand() * 100) + 1,
      })),
    );
    await refreshShopCatalogSummary(shop._id);
  }

  console.log(`Seeded ${NAMES.length} demo shops around ${lat}, ${lng} (types: ${PRODUCT_TYPES.join(", ")}).`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await mongoose.disconnect();
  process.exit(1);
});
