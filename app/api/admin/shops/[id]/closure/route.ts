import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { adminCloseShop, adminReopenShop, getAdminShop } from "@/lib/services/admin/shops";
import { adminShopClosureSchema } from "@/lib/validation/admin";
import { objectIdSchema } from "@/lib/validation/shopkeeper";

/** POST /api/admin/shops/:id/closure — { action: "close", reason } | { action: "reopen" } */
export const POST = apiHandler(async (req, ctx: RouteContext<"/api/admin/shops/[id]/closure">) => {
  const admin = await requireApiUser(["admin"]);
  const id = objectIdSchema.parse((await ctx.params).id);
  const input = await parseBody(req, adminShopClosureSchema);
  if (input.action === "close") await adminCloseShop(admin, id, input.reason);
  else await adminReopenShop(admin, id);
  return json(await getAdminShop(id));
});
