import { describe, expect, it } from "vitest";
import { MAX_RUNNING_DEALS, SPONSOR_PLAN_MONTHLY_PRICE } from "@/lib/ads/constants";
import type { SessionUser } from "@/lib/auth/session";
import { addMonths } from "@/lib/billing/constants";
import { formatPrice } from "@/lib/catalog";
import { dayKey } from "@/lib/ads/dates";
import { AdminAction, Banner, Deal, Shop, SponsoredCampaign, SupportThread, User } from "@/lib/db/models";
import { bannerInputSchema, bannerLinkSchema } from "@/lib/validation/ads";
import { shopSearchSchema } from "@/lib/validation/shops";
import { createShop, createUser, HOME } from "@/test/fixtures";
import { setupTestDb } from "@/test/db";
import {
  bannerClickTarget,
  createBanner,
  deleteBanner,
  getBannerImage,
  getBannerVideo,
  listRunningBanners,
  saveBannerImage,
  saveBannerVideo,
  sniffImageType,
  sniffVideoType,
  updateBanner,
} from "./ads/banners";
import { createMyDeal, endMyDeal, listLatestDeals, removeDealAsAdmin } from "./ads/deals";
import { decideCampaign, findSponsoredShops, isSponsoredNow, requestCampaign, withdrawMyCampaign } from "./ads/sponsored";
import { adTotals, recordAdEvent } from "./ads/stats";
import type { MyShop } from "./my-shop";
import { searchShops } from "./shops";

setupTestDb();

const DAY = 24 * 60 * 60 * 1000;
const today = () => dayKey(new Date());

async function liveShop(overrides: Parameters<typeof createShop>[1] = {}) {
  return createShop(await createUser("shopkeeper"), overrides);
}

/** Request the Sponsored plan as the shop's owner. */
async function requestPlan(shop: MyShop, months: 1 | 2 | 3 = 1, note = "") {
  const owner = (await Shop.findById(shop.id, { ownerId: 1 }).lean())!.ownerId;
  const u = (await User.findById(owner).lean())!;
  return requestCampaign({ id: u._id.toString(), name: u.name, email: u.email, role: "shopkeeper" } as SessionUser, shop, { months, note });
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
  it("prices the plan on the server, allows one pending request, and messages the team", async () => {
    const pending = await createShop(await createUser("shopkeeper"), { status: "pending" });
    await expect(requestPlan(pending)).rejects.toMatchObject({ status: 403 });

    const shop = await liveShop();
    const c = await requestPlan(shop, 3, "TID 123");
    expect(c).toMatchObject({ months: 3, amount: 3 * SPONSOR_PLAN_MONTHLY_PRICE, status: "pending", note: "TID 123" });
    await expect(requestPlan(shop)).rejects.toMatchObject({ status: 409 });

    const thread = await SupportThread.findOne({ shopId: shop.id }).lean();
    expect(thread).toMatchObject({ category: "ads", subject: "Sponsored plan request: 3 months", unreadForAdmin: true });
    expect(thread!.messages[0].body).toContain(`${formatPrice(3 * SPONSOR_PLAN_MONTHLY_PRICE)} in total`);
    expect(thread!.messages[0].body).toContain("TID 123");

    await withdrawMyCampaign(shop, c.id);
    await expect(withdrawMyCampaign(shop, c.id)).rejects.toMatchObject({ status: 409 });
    await requestPlan(shop);
  });

  it("starts the plan when approved, after any running campaign", async () => {
    const admin = await createUser("admin", "Admin");
    const shop = await liveShop();
    const first = await requestPlan(shop, 1);
    // Approved a few days after the request: the month counts from approval.
    await SponsoredCampaign.updateOne({ _id: first.id }, { startsAt: new Date(Date.now() - 5 * DAY), endsAt: new Date(Date.now() + 25 * DAY) });
    await decideCampaign(admin, first.id, { decision: "approve" });
    const a = (await SponsoredCampaign.findById(first.id).lean())!;
    expect(Math.abs(a.startsAt.getTime() - Date.now())).toBeLessThan(60_000);
    expect(a.endsAt.getTime()).toBe(addMonths(a.startsAt, 1).getTime());

    const second = await requestPlan(shop, 2);
    await decideCampaign(admin, second.id, { decision: "approve" });
    const b = (await SponsoredCampaign.findById(second.id).lean())!;
    expect(b.startsAt.getTime()).toBe(a.endsAt.getTime());
    expect(b.endsAt.getTime()).toBe(addMonths(a.endsAt, 2).getTime());
  });

  it("approve, reject and cancel are atomic and audited", async () => {
    const admin = await createUser("admin", "Admin");
    const shop = await liveShop();
    const c = await requestPlan(shop);
    await decideCampaign(admin, c.id, { decision: "approve" });
    await expect(decideCampaign(admin, c.id, { decision: "reject", reason: "late" })).rejects.toMatchObject({ status: 409 });
    expect(await isSponsoredNow(shop.id)).toBe(true);

    await decideCampaign(admin, c.id, { decision: "cancel", reason: "Payment bounced" });
    expect(await isSponsoredNow(shop.id)).toBe(false);

    const r = await requestPlan(shop);
    await decideCampaign(admin, r.id, { decision: "reject", reason: "No payment" });
    expect(await SponsoredCampaign.findById(r.id).lean()).toMatchObject({ status: "rejected", reviewReason: "No payment" });
    expect(await AdminAction.countDocuments({ action: { $regex: /^ads\.campaign\./ } })).toBe(3);
  });

  it("refuses to approve a campaign whose dates have passed", async () => {
    const admin = await createUser("admin", "Admin");
    const shop = await liveShop();
    const c = await requestPlan(shop);
    // Older week-based campaigns keep their own dates.
    await SponsoredCampaign.updateOne({ _id: c.id }, { months: null, endsAt: new Date(Date.now() - 1000) });
    await expect(decideCampaign(admin, c.id, { decision: "approve" })).rejects.toMatchObject({ status: 409 });
    expect(await SponsoredCampaign.findById(c.id).lean()).toMatchObject({ status: "pending" });
  });

  it("picks only shops with a running campaign that are listed, deliver to the customer and match the filters", async () => {
    const admin = await createUser("admin", "Admin");
    const search = (extra: Record<string, string> = {}) =>
      findSponsoredShops(shopSearchSchema.parse({ lat: String(HOME.lat), lng: String(HOME.lng), ...extra }));

    const campaign = await liveShop({ name: "Campaign Shop" });
    const c = await requestPlan(campaign);
    await decideCampaign(admin, c.id, { decision: "approve" });

    const second = await liveShop({ name: "Second Shop" });
    const c2 = await requestPlan(second);
    await decideCampaign(admin, c2.id, { decision: "approve" });
    // A campaign doesn't help a shop whose plan has ended (it isn't listed at all).
    const lapsed = await liveShop({ name: "Lapsed Shop" });
    const c3 = await requestPlan(lapsed);
    await decideCampaign(admin, c3.id, { decision: "approve" });
    await Shop.updateOne({ _id: lapsed.id }, { "subscription.endsAt": new Date(Date.now() - DAY) });
    await liveShop({ name: "Plain Shop" });

    // ~3 km away with a 1 km delivery radius: inside the search radius but doesn't deliver here.
    const far = await liveShop({ name: "Far Shop", location: { lat: HOME.lat + 0.027, lng: HOME.lng }, deliveryRadiusKm: 1 });
    const f = await requestPlan(far);
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

  it("accepts short MP4/WebM videos by their bytes, and attaches, replaces and deletes them with the banner", async () => {
    const mp4 = new Uint8Array([0, 0, 0, 0x18, ...new TextEncoder().encode("ftypmp42"), 0, 0, 0, 0]);
    const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f]);
    expect(sniffVideoType(mp4)).toBe("video/mp4");
    expect(sniffVideoType(webm)).toBe("video/webm");
    expect(sniffVideoType(png)).toBeNull();
    await expect(saveBannerVideo(new TextEncoder().encode("<html>"))).rejects.toMatchObject({ status: 400 });
    await expect(saveBannerVideo(new Uint8Array(8 * 1024 * 1024 + 1))).rejects.toMatchObject({ status: 413 });

    const admin = await createUser("admin", "Admin");
    const first = await saveBannerVideo(mp4);
    expect((await getBannerVideo(first))?.contentType).toBe("video/mp4");
    const input = bannerInputSchema.parse({ title: "Watch this", linkUrl: "/shops", startDate: today(), endDate: today(), videoId: first });
    const id = await createBanner(admin, input);
    expect((await listRunningBanners())[0].videoUrl).toBe(`/api/banner-videos/${first}`);

    // Replacing the clip drops the old one; deleting the banner drops the new one.
    const second = await saveBannerVideo(webm);
    await updateBanner(admin, id, { ...input, videoId: second });
    expect(await getBannerVideo(first)).toBeNull();
    await deleteBanner(admin, id);
    expect(await getBannerVideo(second)).toBeNull();

    await expect(createBanner(admin, { ...input, videoId: "0123456789abcdef01234567" })).rejects.toMatchObject({ status: 400 });
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
