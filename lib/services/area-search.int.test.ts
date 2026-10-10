import { beforeEach, describe, expect, it, vi } from "vitest";
import { shopSearchSchema } from "@/lib/validation/shops";
import { createShop, createUser } from "@/test/fixtures";
import { setupTestDb } from "@/test/db";
import { searchShops } from "./shops";

// Never call the real map service from tests.
const geocode = vi.hoisted(() => vi.fn());
vi.mock("./geocode", () => ({ geocode }));

setupTestDb();

// Orangi Town, Karachi (approximate) and spots around it.
const ORANGI = { lat: 24.955, lng: 66.99 };
const km = (dLatKm: number) => ({ lat: ORANGI.lat + dLatKm / 111, lng: ORANGI.lng });

async function shop(name: string, at: { lat: number; lng: number }, address: { line1: string; area: string; city: string }) {
  return createShop(await createUser("shopkeeper"), { name, location: at, address, deliveryRadiusKm: 5 });
}

const search = (q: Record<string, string>) => searchShops(shopSearchSchema.parse(q));

beforeEach(() => geocode.mockReset());

describe("searching by part of an address", () => {
  it("finds the area from a partial address in any order and lists the shops around it, nearest first", async () => {
    await shop("Bahar Water", ORANGI, { line1: "B1, Street 4", area: "Gulshan-e-Bahar, Orangi Town", city: "Karachi" });
    await shop("Pak Water", km(2), { line1: "Plot 12", area: "Sector 11", city: "Karachi" }); // no matching words, but nearby
    await shop("Far Water", km(40), { line1: "Main Rd", area: "Gulshan-e-Iqbal", city: "Karachi" });

    for (const q of ["orangi town gulshan e bahar", "Gulshan e Bahar", "bahar orangi", "GULSHAN-E-BAHAR, ORANGI TOWN, KARACHI"]) {
      const r = await search({ q });
      expect(r.place).toMatchObject({ source: "shops", label: "Gulshan-e-Bahar, Orangi Town, Karachi" });
      expect(r.items.map((s) => s.name)).toEqual(["Bahar Water", "Pak Water"]);
      expect(r.items[1].distanceKm).toBeCloseTo(2, 0);
    }
    expect(geocode).not.toHaveBeenCalled();
  });

  it("finds a shop by name and shows others near it", async () => {
    await shop("Blue Spring", ORANGI, { line1: "B1", area: "Orangi Town", city: "Karachi" });
    await shop("Neighbour", km(1), { line1: "C3", area: "Banaras", city: "Karachi" });
    expect((await search({ q: "blue spring" })).items.map((s) => s.name)).toEqual(["Blue Spring", "Neighbour"]);
  });

  it("uses the map search when no shop address matches", async () => {
    await shop("Pak Water", km(3), { line1: "Plot 12", area: "Sector 11", city: "Karachi" });
    geocode.mockResolvedValue([{ title: "Qasba Colony", subtitle: "Karachi", lat: ORANGI.lat, lng: ORANGI.lng }]);
    const r = await search({ q: "qasba colony" });
    expect(r.place).toMatchObject({ source: "map", label: "Qasba Colony, Karachi" });
    expect(r.items.map((s) => s.name)).toEqual(["Pak Water"]);
  });

  it("widens the search when nothing is within the chosen distance", async () => {
    await shop("Far Water", km(20), { line1: "Main Rd", area: "Gulshan-e-Iqbal", city: "Karachi" });
    geocode.mockResolvedValue([{ title: "Qasba Colony", subtitle: "Karachi", lat: ORANGI.lat, lng: ORANGI.lng }]);
    const r = await search({ q: "qasba colony", radiusKm: "5" });
    expect(r.widenedToKm).toBe(50);
    expect(r.items.map((s) => s.name)).toEqual(["Far Water"]);
    // Same for a device location.
    const gps = await search({ lat: String(ORANGI.lat), lng: String(ORANGI.lng), radiusKm: "5" });
    expect(gps).toMatchObject({ widenedToKm: 50, total: 1 });
  });

  it("says so when nothing matches anywhere", async () => {
    await shop("Bahar Water", ORANGI, { line1: "B1", area: "Gulshan-e-Bahar", city: "Karachi" });
    geocode.mockResolvedValue([]);
    expect(await search({ q: "zzqx nowhere" })).toMatchObject({ placeNotFound: true, total: 0 });
    // A broken map response (the code throws while reading it): still a clean "not found", never an error page.
    geocode.mockResolvedValue(null);
    expect(await search({ q: "zzqx nowhere" })).toMatchObject({ placeNotFound: true });
  });

  it("can anchor on an approved shop that isn't listed, but only lists listable shops", async () => {
    await shop("Hidden", ORANGI, { line1: "B1", area: "Gulshan-e-Bahar", city: "Karachi" }).then((s) =>
      import("@/lib/db/models").then(({ Shop }) => Shop.updateOne({ _id: s.id }, { pricePerCan: null })),
    );
    await shop("Listed", km(1), { line1: "C3", area: "Banaras", city: "Karachi" });
    expect((await search({ q: "gulshan e bahar" })).items.map((s) => s.name)).toEqual(["Listed"]);
  });
});
