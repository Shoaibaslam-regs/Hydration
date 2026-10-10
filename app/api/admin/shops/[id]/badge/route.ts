import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { getAdminShop, grantVerifiedBadge, revokeVerifiedBadge } from "@/lib/services/admin/shops";
import { adminShopBadgeSchema } from "@/lib/validation/admin";
import { objectIdSchema } from "@/lib/validation/shopkeeper";

/** POST /api/admin/shops/:id/badge — { action: "grant", reason? } | { action: "revoke", reason } */
export const POST = apiHandler(async (req, ctx: RouteContext<"/api/admin/shops/[id]/badge">) => {
  const admin = await requireApiUser(["admin"]);
  const id = objectIdSchema.parse((await ctx.params).id);
  const input = await parseBody(req, adminShopBadgeSchema);
  if (input.action === "grant") await grantVerifiedBadge(admin, id, input.reason);
  else await revokeVerifiedBadge(admin, id, input.reason);
  return json(await getAdminShop(id));
});
