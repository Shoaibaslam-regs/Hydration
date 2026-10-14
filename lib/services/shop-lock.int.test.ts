import { describe, expect, it } from "vitest";
import { isShopLocked } from "@/lib/billing/lock";
import { Shop } from "@/lib/db/models";
import { createShop, createUser } from "@/test/fixtures";
import { setupTestDb } from "@/test/db";
import { approveSubscriptionPayment, submitSubscriptionPayment } from "./billing";
import { getMyShop, requireMyShop } from "./my-shop";
import { getNotificationCounts } from "./notifications";

setupTestDb();

describe("locked shops (plan ended)", () => {
  it("locks an approved shop whose plan ended until a payment is approved", async () => {
    const owner = await createUser("shopkeeper");
    const shop = await createShop(owner, { planEndsAt: new Date(Date.now() - 1000) });

    expect(isShopLocked((await getMyShop(owner.id))!)).toBe(true);
    await expect(requireMyShop(owner.id)).rejects.toMatchObject({ status: 402, code: "PLAN_ENDED" });
    // Billing still works, so they can pay.
    expect((await requireMyShop(owner.id, { allowLocked: true })).id).toBe(shop.id);
    expect(await getNotificationCounts(owner)).toMatchObject({ "/shop/billing": 1 });

    const paid = await submitSubscriptionPayment(shop, owner.id, { planId: "monthly", months: 1, method: "bank_transfer", reference: "TID-1", note: "" });
    await approveSubscriptionPayment(await createUser("admin"), paid.id);

    expect(isShopLocked((await getMyShop(owner.id))!)).toBe(false);
    expect((await requireMyShop(owner.id)).id).toBe(shop.id);
    expect(await getNotificationCounts(owner)).toMatchObject({ "/shop/billing": 0 });
  });

  it("doesn't lock shops that aren't approved yet, or that have a running plan", async () => {
    const pendingOwner = await createUser("shopkeeper");
    await createShop(pendingOwner, { status: "pending", planEndsAt: null });
    expect(isShopLocked((await getMyShop(pendingOwner.id))!)).toBe(false);

    const liveOwner = await createUser("shopkeeper");
    const live = await createShop(liveOwner);
    expect(isShopLocked((await getMyShop(liveOwner.id))!)).toBe(false);
    await Shop.updateOne({ _id: live.id }, { "subscription.endsAt": new Date(Date.now() - 1) });
    expect(isShopLocked((await getMyShop(liveOwner.id))!)).toBe(true);
  });
});
