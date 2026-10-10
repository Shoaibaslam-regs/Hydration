import { apiHandler, json } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { withdrawMyCampaign } from "@/lib/services/ads/sponsored";
import { requireMyShop } from "@/lib/services/my-shop";
import { objectIdSchema } from "@/lib/validation/shopkeeper";

/** DELETE /api/shopkeeper/campaigns/:id — withdraw a request that's still waiting for review. */
export const DELETE = apiHandler(async (_req, ctx: RouteContext<"/api/shopkeeper/campaigns/[id]">) => {
  const user = await requireApiUser(["shopkeeper"]);
  await withdrawMyCampaign(await requireMyShop(user.id), objectIdSchema.parse((await ctx.params).id));
  return json({ ok: true });
});
