import { describe, expect, it } from "vitest";
import { MAX_RUNNING_DEALS } from "@/lib/ads/constants";
import { dayKey } from "@/lib/ads/dates";
import { AdminAction, Banner, Deal, Shop, SponsoredCampaign } from "@/lib/db/models";
import { bannerInputSchema, bannerLinkSchema } from "@/lib/validation/ads";
import { shopSearchSchema } from "@/lib/validation/shops";
import { createShop, createUser, HOME } from "@/test/fixtures";
import { setupTestDb } from "@/test/db";
import { bannerClickTarget, createBanner, getBannerImage, listRunningBanners, saveBannerImage, sniffImageType, updateBanner } from "./ads/banners";
import { createMyDeal, endMyDeal, listLatestDeals, removeDealAsAdmin } from "./ads/deals";
import { decideCampaign, findSponsoredShops, isSponsoredNow, requestCampaign, withdrawMyCampaign } from "./ads/sponsored";
import { adTotals, recordAdEvent } from "./ads/stats";
import { searchShops } from "./shops";

setupTestDb();

const DAY = 24 * 60 * 60 * 1000;
const today = () => dayKey(new Date());

async function liveShop(overrides: Parameters<typeof createShop>[1] = {}) {
  return createShop(await createUser("shopkeeper"), overrides);
}

describe("deals", () => {
  it("runs at most three at once and puts the longest-running one on the shop", async () => {
    const shop = await liveShop();
    await createMyDeal(shop, { title: "Short one", description: "", days: 1 });
    const long = await createMyDeal(shop, { title: "Long one", description: "", days: 14 });
    await createMyDeal(shop, { title: "Mid one", description: "", days: 7 });
    await expect(createMyDeal(shop, { title: "Fourth", description: "", days: 3 })).rejects.toMatchObject({ status: 409 });
    expect(MAX_RUNNING_DEALS).toBe(3);
    expect((await Shop.findById(shop.id).lean())!.featuredDeal).toMatchObject({ title: "Long one" });

    // Ending the featured deal promotes the next one and frees a slot.
    await endMyDeal(shop, long.id);
    expect((await Shop.findById(shop.id).lean())!.featuredDeal).toMatchObject({ title: "Mid one" });
    await createMyDeal(shop, { title: "Fourth", description: "", days: 3 });

    const found = await searchShops(shopSearchSchema.parse({ lat: String(HOME.lat), lng: String(HOME.lng), deals: "1" }));
    expect(found.items.map((s) => s.id)).toEqual([shop.id]);
    expect(found.items[0].deal).toMatchObject({ title: "Mid one" });
  });

  it("can't end another shop's deal; an admin removal is audited and clears the tag", async () => {
    const shop = await liveShop();
    const other = await liveShop();
    const deal = await createMyDeal(shop, { title: "Cheap cans", description: "", days: 7 });
    await expect(endMyDeal(other, deal.id)).rejects.toMatchObject({ status: 404 });
    expect((await listLatestDeals()).map((d) => d.id)).toEqual([deal.id]);

    const admin = await createUser("admin", "Admin");
    await removeDealAsAdmin(admin, deal.id, "Misleading price");
    await expect(removeDealAsAdmin(admin, deal.id, "again")).rejects.toMatchObject({ status: 409 });
    expect(await Deal.findById(deal.id).lean()).toMatchObject({ removedBy: "admin", removedReason: "Misleading price" });
    expect((await Shop.findById(shop.id).lean())!.featuredDeal).toBeNull();
    expect(await listLatestDeals()).toEqual([]);
    expect(await AdminAction.countDocuments({ action: "ads.deal.removed" })).toBe(1);
  });

  it("hides deals from shops customers can't see", async () => {
    const shop = await liveShop({ status: "pending" });
    await createMyDeal(shop, { title: "Not yet", description: "", days: 7 });
    expect(await listLatestDeals()).toEqual([]);
  });
});

describe("sponsored campaigns", () => {
  it("validates requests and allows one pending at a time", async () => {
    const pending = await createShop(await createUser("shopkeeper"), { status: "pending" });
    await expect(requestCampaign(pending, { startDate: today(), weeks: 1, note: "" })).rejects.toMatchObject({ status: 403 });

    const shop = await liveShop();
    const yesterday = dayKey(new Date(Date.now() - DAY));
    await expect(requestCampaign(shop, { startDate: yesterday, weeks: 1, note: "" })).rejects.toMatchObject({ status: 400 });

    const c = await requestCampaign(shop, { startDate: today(), weeks: 2, note: "TID 123" });
    const days = (new Date(c.endsAt).getTime() - new Date(c.startsAt).getTime()) / DAY;
    expect(Math.round(days)).toBe(14);
    await expect(requestCampaign(shop, { startDate: today(), weeks: 1, note: "" })).rejects.toMatchObject({ status: 409 });

    await withdrawMyCampaign(shop, c.id);
    await expect(withdrawMyCampaign(shop, c.id)).rejects.toMatchObject({ status: 409 });
    await requestCampaign(shop, { startDate: today(), weeks: 1, note: "" });
  });

  it("approve, reject and cancel are atomic and audited", async () => {
    const admin = await createUser("admin", "Admin");
    const shop = await liveShop();
    const c = await requestCampaign(shop, { startDate: today(), weeks: 1, note: "" });
    await decideCampaign(admin, c.id, { decision: "approve" });
    await expect(decideCampaign(admin, c.id, { decision: "reject", reason: "late" })).rejects.toMatchObject({ status: 409 });
    expect(await isSponsoredNow(shop.id)).toBe(true);

    await decideCampaign(admin, c.id, { decision: "cancel", reason: "Payment bounced" });
    expect(await isSponsoredNow(shop.id)).toBe(false);

    const r = await requestCampaign(shop, { startDate: today(), weeks: 1, note: "" });
    await decideCampaign(admin, r.id, { decision: "reject", reason: "No payment" });
    expect(await SponsoredCampaign.findById(r.id).lean()).toMatchObject({ status: "rejected", reviewReason: "No payment" });
    expect(await AdminAction.countDocuments({ action: { $regex: /^ads\.campaign\./ } })).toBe(3);
  });

  it("refuses to approve a campaign whose dates have passed", async () => {
    const admin = await createUser("admin", "Admin");
    const shop = await liveShop();
    const c = await requestCampaign(shop, { startDate: today(), weeks: 1, note: "" });
    await SponsoredCampaign.updateOne({ _id: c.id }, { endsAt: new Date(Date.now() - 1000) });
    await expect(decideCampaign(admin, c.id, { decision: "approve" })).rejects.toMatchObject({ status: 409 });
    expect(await SponsoredCampaign.findById(c.id).lean()).toMatchObject({ status: "pending" });
  });

  it("picks only shops with a running campaign that are listed, deliver to the customer and match the filters", async () => {
    const admin = await createUser("admin", "Admin");
    const search = (extra: Record<string, string> = {}) =>
      findSponsoredShops(shopSearchSchema.parse({ lat: String(HOME.lat), lng: String(HOME.lng), ...extra }));

    const campaign = await liveShop({ name: "Campaign Shop" });
    const c = await requestCampaign(campaign, { startDate: today(), weeks: 1, note: "" });
    await decideCampaign(admin, c.id, { decision: "approve" });

    const second = await liveShop({ name: "Second Shop" });
    const c2 = await requestCampaign(second, { startDate: today(), weeks: 1, note: "" });
    await decideCampaign(admin, c2.id, { decision: "approve" });
    // A campaign doesn't help a shop whose plan has ended (it isn't listed at all).
    const lapsed = await liveShop({ name: "Lapsed Shop" });
    const c3 = await requestCampaign(lapsed, { startDate: today(), weeks: 1, note: "" });
    await decideCampaign(admin, c3.id, { decision: "approve" });
    await Shop.updateOne({ _id: lapsed.id }, { "subscription.endsAt": new Date(Date.now() - DAY) });
    await liveShop({ name: "Plain Shop" });

    // ~3 km away with a 1 km delivery radius: inside the search radius but doesn't deliver here.
    const far = await liveShop({ name: "Far Shop", location: { lat: HOME.lat + 0.027, lng: HOME.lng }, deliveryRadiusKm: 1 });
    const f = await requestCampaign(far, { startDate: today(), weeks: 1, note: "" });
    await decideCampaign(admin, f.id, { decision: "approve" });

    expect((await search()).map((s) => s.name).sort()).toEqual(["Campaign Shop", "Second Shop"]);

    // Filters apply to sponsored shops too.
    await createMyDeal(second, { title: "Deal", description: "", days: 3 });
    expect((await search({ deals: "1" })).map((s) => s.name)).toEqual(["Second Shop"]);

    // No location → no sponsored row.
    expect(await findSponsoredShops(shopSearchSchema.parse({}))).toEqual([]);
  });
});

describe("banners", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);

  it("only accepts same-site paths or https links", () => {
    for (const ok of ["/shops", "/shops?deals=1", "https://example.com/x"]) expect(bannerLinkSchema.safeParse(ok).success).toBe(true);
    for (const bad of ["javascript:alert(1)", "//evil.com", "/\\evil.com", "http://example.com", "data:text/html,x", "shops"]) {
      expect(bannerLinkSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("checks image bytes, not the claimed type", async () => {
    expect(sniffImageType(png)).toBe("image/png");
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    await expect(saveBannerImage(new TextEncoder().encode("<svg></svg>"))).rejects.toMatchObject({ status: 400 });
    await expect(saveBannerImage(new Uint8Array(2 * 1024 * 1024 + 1))).rejects.toMatchObject({ status: 413 });
    const id = await saveBannerImage(png);
    const stored = await getBannerImage(id);
    expect(stored?.contentType).toBe("image/png");
    expect(new Uint8Array(stored!.data)).toEqual(png);
  });

  it("shows and links only while running and switched on", async () => {
    const admin = await createUser("admin", "Admin");
    const input = bannerInputSchema.parse({ title: "Summer sale", linkUrl: "/shops?deals=1", startDate: today(), endDate: today() });
    const id = await createBanner(admin, input);
    expect((await listRunningBanners()).map((b) => b.id)).toEqual([id]);
    expect(await bannerClickTarget(id)).toBe("/shops?deals=1");

    await updateBanner(admin, id, { ...input, isActive: false });
    expect(await listRunningBanners()).toEqual([]);
    expect(await bannerClickTarget(id)).toBeNull();

    const tomorrow = dayKey(new Date(Date.now() + DAY));
    await updateBanner(admin, id, { ...input, startDate: tomorrow, endDate: tomorrow });
    expect(await bannerClickTarget(id)).toBeNull();

    expect(bannerInputSchema.safeParse({ ...input, endDate: "2000-01-01" }).success).toBe(false);
    await expect(createBanner(admin, { ...input, imageId: "0123456789abcdef01234567" })).rejects.toMatchObject({ status: 400 });
    expect(await Banner.countDocuments()).toBe(1);
  });
});

describe("ad stats", () => {
  it("counts impressions and clicks per ad", async () => {
    const shop = await liveShop();
    await recordAdEvent("sponsored", shop.id, "impression");
    await recordAdEvent("sponsored", shop.id, "impression");
    await recordAdEvent("sponsored", shop.id, "click");
    await recordAdEvent("banner", shop.id, "click"); // other kind, same id: counted separately
    const totals = await adTotals("sponsored", [shop.id], 30);
    expect(totals.get(shop.id)).toEqual({ impressions: 2, clicks: 1 });
  });
});
