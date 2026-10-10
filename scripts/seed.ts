// Seeds demo shops around a point, for local development. Approved demo shops
// get a price per can and a running plan, so they appear in search.
// Usage: npm run db:seed -- --lat 31.5204 --lng 74.3587
// Re-running replaces previous demo data (shops with slugs starting "demo-").
import mongoose, { Types } from "mongoose";
import { connectDB } from "../lib/db/connect";
import { Shop } from "../lib/db/models";
import { PLANS, TRIAL_PLAN_ID } from "../lib/plans";
import { shopSearchText } from "../lib/search/text";

const NAMES = [
  "Blue Spring Water", "Crystal Drops", "Pure Flow", "Fresh Aqua Point", "Clear Stream",
  "Mountain Fresh", "Rain Drop Water", "Pristine Water Co", "Oasis Refills", "Hydro Hub",
  "Glacier Water", "Spring Valley",
];
const AREAS = ["North", "South", "East", "West", "Central", "Old Town"];

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
  await Shop.deleteMany({ _id: { $in: old.map((s) => s._id) } });

  for (const [i, name] of NAMES.entries()) {
    // Scatter within ~8 km of the center.
    const r = 8 * Math.sqrt(rand());
    const theta = 2 * Math.PI * rand();
    const dLat = (r * Math.cos(theta)) / 111;
    const dLng = (r * Math.sin(theta)) / (111 * Math.cos((lat * Math.PI) / 180));

    const approved = i !== NAMES.length - 1;
    await Shop.create({
      ownerId: new Types.ObjectId(),
      name,
      slug: `demo-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      description: `${name} delivers clean, filtered drinking water to homes and offices nearby.`,
      phone: `+00 300 000 ${String(1000 + i)}`,
      address: { line1: `${10 + i} Demo Street`, area: AREAS[i % AREAS.length], city: "Demo City" },
      searchText: shopSearchText({ name, address: { line1: `${10 + i} Demo Street`, area: AREAS[i % AREAS.length], city: "Demo City" } }),
      location: { type: "Point", coordinates: [lng + dLng, lat + dLat] },
      deliveryRadiusKm: 3 + Math.floor(rand() * 8),
      deliveryFee: rand() < 0.3 ? 0 : (2 + Math.floor(rand() * 6)) * 1000,
      hours: { opensAt: rand() < 0.5 ? "08:00" : "09:00", closesAt: rand() < 0.5 ? "21:00" : "23:00" },
      pricePerCan: (90 + Math.floor(rand() * 60)) * 100,
      // One pending shop to confirm unapproved shops stay hidden.
      status: approved ? "verified" : "pending",
      // Half on the free trial, half on the paid plan.
      ...(approved && {
        trialStartedAt: new Date(),
        subscription: { planId: i % 2 ? TRIAL_PLAN_ID : PLANS[0].id, endsAt: new Date(Date.now() + (i % 2 ? 3 : 30) * 864e5) },
      }),
      rating: { average: Math.round((3 + rand() * 2) * 10) / 10, count: Math.floor(rand() * 200) },
    });

  }

  console.log(`Seeded ${NAMES.length} demo shops around ${lat}, ${lng}.`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await mongoose.disconnect();
  process.exit(1);
});
