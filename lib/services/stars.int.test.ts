import { describe, expect, it } from "vitest";
import { AdminAction, StarCustomer, SupportThread } from "@/lib/db/models";
import { shopSearchSchema } from "@/lib/validation/shops";
import { createShop, createUser, HOME, placeTestOrder } from "@/test/fixtures";
import { setupTestDb } from "@/test/db";
import { getAdminShop, grantStarAward, revokeStarAward, STAR_AWARD_MESSAGE } from "./admin/shops";
import { deleteUserAccount } from "./admin/user-removal";
import { getMyShop } from "./my-shop";
import { getShopOrder, listShopOrders } from "./shop-orders";
import { getShopBySlug, searchShops } from "./shops";
import { isStarCustomerOf, listMyStarCustomers, listShopsThatStarredMe, setStarCustomer } from "./star-customers";
import { getMySupportThread, listMySupportThreads, startSupportThreadAsAdmin } from "./support";

setupTestDb();

describe("Star shop award", () => {
  it("shows everywhere, congratulates the owner, can be removed, and is audited", async () => {
    const owner = await createUser("shopkeeper");
    const shop = await createShop(owner);
    const admin = await createUser("admin", "Admin");
    const inSearch = async () =>
      (await searchShops(shopSearchSchema.parse({ lat: HOME.lat, lng: HOME.lng }))).items.find((s) => s.id === shop.id)?.hasStarAward;

    expect(await inSearch()).toBe(false);
    await grantStarAward(admin, shop.id);
    await expect(grantStarAward(admin, shop.id)).rejects.toMatchObject({ status: 409 });
    expect(await inSearch()).toBe(true);
    expect((await getShopBySlug(shop.slug))?.hasStarAward).toBe(true);
    expect((await getMyShop(owner.id))?.hasStarAward).toBe(true);
    expect((await getAdminShop(shop.id))?.starGrantedAt).toEqual(expect.any(String));

    // The owner gets the standard congratulations, unread, signed by the team.
    const [thread] = await listMySupportThreads(owner.id);
    expect(thread).toMatchObject({ category: "aqua", unread: true, lastMessageBy: "admin" });
    const detail = (await getMySupportThread(owner.id, thread.id))!;
    expect(detail.messages[0]).toMatchObject({ by: "admin", authorName: "Aqua team", body: STAR_AWARD_MESSAGE });

    await revokeStarAward(admin, shop.id, "Many complaints");
    expect(await inSearch()).toBe(false);
    await expect(revokeStarAward(admin, shop.id, "again")).rejects.toMatchObject({ status: 409 });

    const log = await AdminAction.find({ targetId: shop.id }).sort({ createdAt: 1 }).lean();
    expect(log.map((a) => a.action)).toEqual(["shop.star.granted", "shop.star.revoked"]);
  });

  it("sends the admin's own note when given", async () => {
    const owner = await createUser("shopkeeper");
    const shop = await createShop(owner);
    await grantStarAward(await createUser("admin"), shop.id, "Fastest deliveries in Gulshan!");
    const t = await SupportThread.findOne({ userId: owner.id }).lean();
    expect(t?.messages[0].body).toBe("Fastest deliveries in Gulshan!");
  });
});

describe("admin messages", () => {
  it("lets the team start a conversation with a customer or shopkeeper, but not an admin", async () => {
    const admin = await createUser("admin");
    const customer = await createUser("customer");
    const id = await startSupportThreadAsAdmin(admin, customer.id, { subject: "Thank you", body: "Thanks for using Aqua!" });
    const t = (await getMySupportThread(customer.id, id))!;
    expect(t).toMatchObject({ userRole: "customer", category: "aqua", subject: "Thank you" });
    expect(t.messages).toHaveLength(1);
    await expect(startSupportThreadAsAdmin(admin, admin.id, { subject: "Hi", body: "x" })).rejects.toMatchObject({ status: 400 });
    await expect(startSupportThreadAsAdmin(admin, "aaaaaaaaaaaaaaaaaaaaaaaa", { subject: "Hi", body: "x" })).rejects.toMatchObject({ status: 404 });
    expect(await AdminAction.countDocuments({ action: "support.sent", targetId: customer.id })).toBe(1);
  });
});

describe("Star customers", () => {
  it("lets a shop tag a customer through its own orders, and shows it to both sides", async () => {
    const owner = await createUser("shopkeeper");
    const shop = await createShop(owner);
    const { id, customer } = await placeTestOrder(shop, 2);

    expect((await getShopOrder(shop, id))!.isStarCustomer).toBe(false);
    await setStarCustomer(shop, id, true);
    await setStarCustomer(shop, id, true); // idempotent
    expect(await StarCustomer.countDocuments()).toBe(1);

    expect((await getShopOrder(shop, id))!.isStarCustomer).toBe(true);
    expect((await listShopOrders(shop, { page: 1, limit: 20 })).items[0].isStarCustomer).toBe(true);
    expect(await listMyStarCustomers(shop.id)).toEqual([expect.objectContaining({ name: customer.name, publicId: expect.stringMatching(/^CU-/) })]);
    expect(await listShopsThatStarredMe(customer.id)).toEqual([expect.objectContaining({ slug: shop.slug, name: shop.name })]);
    expect(await isStarCustomerOf(customer.id, shop.id)).toBe(true);

    await setStarCustomer(shop, id, false);
    expect(await isStarCustomerOf(customer.id, shop.id)).toBe(false);
  });

  it("can't tag through another shop's order", async () => {
    const shop = await createShop(await createUser("shopkeeper"));
    const other = await createShop(await createUser("shopkeeper"));
    const { id } = await placeTestOrder(other, 1);
    await expect(setStarCustomer(shop, id, true)).rejects.toMatchObject({ status: 404 });
  });

  it("is removed with the customer's account", async () => {
    const shop = await createShop(await createUser("shopkeeper"));
    const { id, customer } = await placeTestOrder(shop, 1);
    await setStarCustomer(shop, id, true);
    const admin = await createUser("admin");
    await deleteUserAccount(admin, customer.id, customer.email, "test");
    expect(await StarCustomer.countDocuments()).toBe(0);
  });
});
