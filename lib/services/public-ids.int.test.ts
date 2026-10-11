import { describe, expect, it } from "vitest";
import { Shop, User } from "@/lib/db/models";
import { createShop, createUser } from "@/test/fixtures";
import { setupTestDb } from "@/test/db";
import { listAdminShops } from "./admin/shops";
import { getAdminUser, listAdminUsers } from "./admin/users";
import { backfillPublicIds } from "./public-ids";
import { getProfile, registerUser } from "./users";

setupTestDb();

describe("public ids", () => {
  it("are given on sign-up by role, and to shops on create", async () => {
    const c = await registerUser({ name: "Sara", email: "sara@t.test", password: "secret123", role: "customer" });
    const k = await registerUser({ name: "Ali", email: "ali@t.test", password: "secret123", role: "shopkeeper" });
    expect((await getProfile(c.id))!.publicId).toMatch(/^CU-[A-Z2-9]{6}$/);
    expect((await getProfile(k.id))!.publicId).toMatch(/^SK-[A-Z2-9]{6}$/);
    expect((await createUser("admin")).id && (await User.findOne({ role: "admin" }).lean())!.publicId).toMatch(/^AD-/);
    const shop = await createShop(await createUser("shopkeeper"));
    expect(shop.publicId).toMatch(/^SH-[A-Z2-9]{6}$/);
  });

  it("let admins search by ID, with or without the hyphen", async () => {
    const owner = await createUser("shopkeeper", "Ali Raza");
    const shop = await createShop(owner, { name: "Blue Spring" });
    const ownerId = (await getAdminUser(owner.id))!.publicId;
    const byUserId = await listAdminUsers({ page: 1, limit: 20, q: ownerId.replace("-", "").toLowerCase() });
    expect(byUserId.items.map((u) => u.id)).toEqual([owner.id]);
    expect((await listAdminShops({ page: 1, limit: 20, q: shop.publicId })).items.map((s) => s.id)).toEqual([shop.id]);
    // A shopkeeper's ID finds their shop too.
    expect((await listAdminShops({ page: 1, limit: 20, q: ownerId })).items.map((s) => s.id)).toEqual([shop.id]);
  });

  it("are backfilled for older records, once", async () => {
    const u = await createUser("customer");
    const shop = await createShop(await createUser("shopkeeper"));
    await User.collection.updateMany({}, { $unset: { publicId: "" } });
    await Shop.collection.updateOne({ _id: new (await import("mongoose")).Types.ObjectId(shop.id) }, { $unset: { publicId: "" } });
    expect(await backfillPublicIds()).toEqual({ users: 2, shops: 1 });
    expect((await User.findById(u.id).lean())!.publicId).toMatch(/^CU-/);
    expect(await backfillPublicIds()).toEqual({ users: 0, shops: 0 });
  });
});
