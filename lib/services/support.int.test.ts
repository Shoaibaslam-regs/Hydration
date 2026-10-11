import { describe, expect, it } from "vitest";
import { SupportThread, User } from "@/lib/db/models";
import { MAX_SUPPORT_MESSAGES } from "@/lib/support/constants";
import { createShop, createUser } from "@/test/fixtures";
import { setupTestDb } from "@/test/db";
import { deleteUserAccount } from "./admin/user-removal";
import { getNotificationCounts } from "./notifications";
import {
  createSupportThread,
  getMySupportThread,
  getSupportThreadForAdmin,
  listMySupportThreads,
  listSupportThreadsForAdmin,
  replyAsAdmin,
  replyAsUser,
  setMySupportThreadStatus,
  setSupportThreadStatusAsAdmin,
} from "./support";

setupTestDb();

const msg = { category: "billing" as const, subject: "Payment not showing", body: "I paid PKR 1,500 by JazzCash, ref 12345." };

describe("support conversations", () => {
  it("flows between a shopkeeper and the team with unread counts on both sides", async () => {
    const owner = await createUser("shopkeeper", "Ali Raza");
    const shop = await createShop(owner, { name: "Blue Spring" });
    const admin = await createUser("admin", "Admin Person");

    const id = await createSupportThread(owner, msg);
    expect(await getNotificationCounts(admin)).toMatchObject({ "/admin/support": 1 });
    expect(await getNotificationCounts(owner)).toMatchObject({ "/shop/support": 0 });

    const forAdmin = await getSupportThreadForAdmin(id);
    expect(forAdmin).toMatchObject({ userRole: "shopkeeper", userName: "Ali Raza", shopName: "Blue Spring", shopId: shop.id, unread: true, messages: [{ by: "shopkeeper", authorName: "Ali Raza" }] });
    expect(forAdmin!.userPublicId).toMatch(/^SK-/);
    expect(await getNotificationCounts(admin)).toMatchObject({ "/admin/support": 0 }); // opening marks it read

    await replyAsAdmin(admin, id, "Thanks, we've approved it.");
    expect(await getNotificationCounts(owner)).toMatchObject({ "/shop/support": 1 });
    const mine = await getMySupportThread(owner.id, id);
    expect(mine!.messages.at(-1)).toMatchObject({ by: "admin", authorName: "Aqua team" }); // never the admin's own name
    expect(await getNotificationCounts(owner)).toMatchObject({ "/shop/support": 0 });

    // Resolved, then a shopkeeper reply reopens it and notifies the team again.
    await setSupportThreadStatusAsAdmin(id, "closed");
    await replyAsUser(owner, id, "One more question…");
    expect(await SupportThread.findById(id).lean()).toMatchObject({ status: "open", unreadForAdmin: true });
    await setMySupportThreadStatus(owner.id, id, "closed");
    expect((await listSupportThreadsForAdmin({ page: 1, limit: 20, status: "closed" })).items.map((t) => t.id)).toEqual([id]);
  });

  it("keeps each shopkeeper's conversations private", async () => {
    const a = await createUser("shopkeeper");
    const b = await createUser("shopkeeper");
    const id = await createSupportThread(a, msg);
    expect(await getMySupportThread(b.id, id)).toBeNull();
    expect(await listMySupportThreads(b.id)).toEqual([]);
    await expect(replyAsUser(b, id, "hi")).rejects.toMatchObject({ status: 404 });
    await expect(setMySupportThreadStatus(b.id, id, "closed")).rejects.toMatchObject({ status: 404 });
    expect(await getMySupportThread(a.id, "not-an-id")).toBeNull();
  });

  it("works before a shop is registered", async () => {
    const owner = await createUser("shopkeeper");
    const id = await createSupportThread(owner, { ...msg, category: "shop", subject: "Can't register" });
    expect(await getSupportThreadForAdmin(id)).toMatchObject({ shopId: null, shopName: "" });
  });

  it("is open to customers too, with their own topics", async () => {
    const admin = await createUser("admin");
    const customer = await createUser("customer", "Sara Khan");
    await expect(createSupportThread(customer, { category: "billing", subject: "Plans?", body: "x" })).rejects.toMatchObject({ status: 400 });
    const id = await createSupportThread(customer, { category: "complaint", subject: "Late delivery", body: "Order AQ-1234 was 3 hours late." });
    expect(await getSupportThreadForAdmin(id)).toMatchObject({ userRole: "customer", shopId: null, messages: [{ by: "customer" }] });
    expect((await listSupportThreadsForAdmin({ page: 1, limit: 20, status: "open", role: "customer" })).total).toBe(1);
    expect((await listSupportThreadsForAdmin({ page: 1, limit: 20, status: "open", role: "shopkeeper" })).total).toBe(0);
    await replyAsAdmin(admin, id, "Sorry about that, we've spoken to the shop.");
    expect(await getNotificationCounts(customer)).toMatchObject({ "/account/support": 1 });
    expect((await getMySupportThread(customer.id, id))!.messages.at(-1)).toMatchObject({ by: "admin" });
    expect(await getNotificationCounts(customer)).toMatchObject({ "/account/support": 0 });
    await expect(createSupportThread(admin, { category: "other", subject: "Hello", body: "x" })).rejects.toMatchObject({ status: 403 });
  });

  it("stops at the message limit", async () => {
    const owner = await createUser("shopkeeper");
    const id = await createSupportThread(owner, msg);
    const filler = Array.from({ length: MAX_SUPPORT_MESSAGES - 1 }, () => ({ by: "shopkeeper", authorId: owner.id, authorName: "x", body: "x", at: new Date() }));
    await SupportThread.updateOne({ _id: id }, { $push: { messages: { $each: filler } } });
    const admin = await createUser("admin");
    await expect(replyAsAdmin(admin, id, "too many")).rejects.toMatchObject({ status: 409 });
  });

  it("is removed with the shopkeeper's account", async () => {
    const admin = await createUser("admin");
    const owner = await createUser("shopkeeper");
    await createSupportThread(owner, msg);
    const email = (await User.findById(owner.id).lean())!.email;
    await deleteUserAccount(admin, owner.id, email, "Requested");
    expect(await SupportThread.countDocuments()).toBe(0);
  });
});
