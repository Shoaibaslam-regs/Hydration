import { apiHandler, json } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { removeMyCampaign } from "@/lib/services/ads/sponsored";
import { requireMyShop } from "@/lib/services/my-shop";
import { objectIdSchema } from "@/lib/validation/shopkeeper";

/** DELETE /api/shopkeeper/campaigns/:id — withdraw a pending request, or remove a finished one from your history. */
export const DELETE = apiHandler(async (_req, ctx: RouteContext<"/api/shopkeeper/campaigns/[id]">) => {
  const user = await requireApiUser(["shopkeeper"]);
  return json({ result: await removeMyCampaign(await requireMyShop(user.id), objectIdSchema.parse((await ctx.params).id)) });
});
