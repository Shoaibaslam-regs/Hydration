import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { removeDealAsAdmin } from "@/lib/services/ads/deals";
import { reasonSchema } from "@/lib/validation/ads";
import { objectIdSchema } from "@/lib/validation/shopkeeper";

/** DELETE /api/admin/deals/:id — { reason }: take a deal down. */
export const DELETE = apiHandler(async (req, ctx: RouteContext<"/api/admin/deals/[id]">) => {
  const admin = await requireApiUser(["admin"]);
  const { reason } = await parseBody(req, reasonSchema);
  await removeDealAsAdmin(admin, objectIdSchema.parse((await ctx.params).id), reason);
  return json({ ok: true });
});
