import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { listMyCampaigns, requestCampaign } from "@/lib/services/ads/sponsored";
import { requireMyShop } from "@/lib/services/my-shop";
import { campaignRequestSchema } from "@/lib/validation/ads";

/** GET /api/shopkeeper/campaigns */
export const GET = apiHandler(async () => {
  const user = await requireApiUser(["shopkeeper"]);
  return json({ items: await listMyCampaigns(await requireMyShop(user.id)) });
});

/** POST /api/shopkeeper/campaigns — { startDate: "YYYY-MM-DD", weeks: 1|2|4, note? } */
export const POST = apiHandler(async (req) => {
  const user = await requireApiUser(["shopkeeper"]);
  const shop = await requireMyShop(user.id);
  return json(await requestCampaign(shop, await parseBody(req, campaignRequestSchema)), 201);
});
