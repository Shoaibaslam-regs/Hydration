import { apiHandler, json } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { removeMyDeal } from "@/lib/services/ads/deals";
import { requireMyShop } from "@/lib/services/my-shop";
import { objectIdSchema } from "@/lib/validation/shopkeeper";

/** DELETE /api/shopkeeper/deals/:id — end a running deal now, or delete an ended one from your list. */
export const DELETE = apiHandler(async (_req, ctx: RouteContext<"/api/shopkeeper/deals/[id]">) => {
  const user = await requireApiUser(["shopkeeper"]);
  return json({ result: await removeMyDeal(await requireMyShop(user.id), objectIdSchema.parse((await ctx.params).id)) });
});
