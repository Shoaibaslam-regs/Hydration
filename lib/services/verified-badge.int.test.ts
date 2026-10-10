import { describe, expect, it } from "vitest";
import { AdminAction } from "@/lib/db/models";
import { shopSearchSchema } from "@/lib/validation/shops";
import { createProduct, createShop, createUser, HOME } from "@/test/fixtures";
import { setupTestDb } from "@/test/db";
import { getAdminShop, grantVerifiedBadge, revokeVerifiedBadge } from "./admin/shops";
import { getMyShop } from "./my-shop";
import { getShopBySlug, searchShops } from "./shops";

setupTestDb();

describe("verified badge", () => {
  it("can be given once and removed with a reason, shows everywhere, and is audited", async () => {
    const owner = await createUser("shopkeeper");
    const shop = await createShop(owner);
    await createProduct(shop);
    const admin = await createUser("admin", "Admin");
    const badgeInSearch = async () =>
      (await searchShops(shopSearchSchema.parse({ lat: HOME.lat, lng: HOME.lng }))).items.find((s) => s.id === shop.id)?.hasVerifiedBadge;

    expect(await badgeInSearch()).toBe(false);
    await grantVerifiedBadge(admin, shop.id, "Visited the shop");
    await expect(grantVerifiedBadge(admin, shop.id)).rejects.toMatchObject({ status: 409 });

    expect(await badgeInSearch()).toBe(true);
    expect((await getShopBySlug(shop.slug))?.hasVerifiedBadge).toBe(true);
    expect((await getMyShop(owner.id))?.hasVerifiedBadge).toBe(true);
    expect((await getAdminShop(shop.id))?.badgeGrantedAt).toEqual(expect.any(String));

    await revokeVerifiedBadge(admin, shop.id, "Licence expired");
    expect(await badgeInSearch()).toBe(false);
    await expect(revokeVerifiedBadge(admin, shop.id, "again")).rejects.toMatchObject({ status: 409 });
    await expect(grantVerifiedBadge(admin, "aaaaaaaaaaaaaaaaaaaaaaaa")).rejects.toMatchObject({ status: 404 });

    const log = await AdminAction.find({ targetId: shop.id }).sort({ createdAt: 1 }).lean();
    expect(log.map((a) => [a.action, a.reason])).toEqual([
      ["shop.badge.granted", "Visited the shop"],
      ["shop.badge.revoked", "Licence expired"],
    ]);
  });

  it("can be given to a shop that isn't approved yet", async () => {
    const shop = await createShop(await createUser("shopkeeper"), { status: "pending" });
    await grantVerifiedBadge(await createUser("admin"), shop.id);
    expect((await getAdminShop(shop.id))?.hasVerifiedBadge).toBe(true);
  });
});
