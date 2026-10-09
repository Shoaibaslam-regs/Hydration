import { apiHandler, json } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { removeFavorite } from "@/lib/services/favorites";
import { objectIdSchema } from "@/lib/validation/shopkeeper";

/** DELETE /api/customer/favorites/:shopId */
export const DELETE = apiHandler(async (_req, ctx: RouteContext<"/api/customer/favorites/[shopId]">) => {
  const user = await requireApiUser(["customer"]);
  await removeFavorite(user.id, objectIdSchema.parse((await ctx.params).shopId));
  return json({ ok: true, favorite: false });
});
