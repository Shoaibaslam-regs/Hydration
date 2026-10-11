import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { getAdminShop, grantStarAward, revokeStarAward } from "@/lib/services/admin/shops";
import { adminShopStarSchema } from "@/lib/validation/admin";
import { objectIdSchema } from "@/lib/validation/shopkeeper";

/** POST /api/admin/shops/:id/star — { action: "grant", message? } | { action: "revoke", reason } */
export const POST = apiHandler(async (req, ctx: RouteContext<"/api/admin/shops/[id]/star">) => {
  const admin = await requireApiUser(["admin"]);
  const id = objectIdSchema.parse((await ctx.params).id);
  const input = await parseBody(req, adminShopStarSchema);
  if (input.action === "grant") await grantStarAward(admin, id, input.message);
  else await revokeStarAward(admin, id, input.reason);
  return json(await getAdminShop(id));
});
