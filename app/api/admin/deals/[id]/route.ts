import { z } from "zod";
import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { adminRemoveOrDeleteDeal } from "@/lib/services/ads/deals";
import { objectIdSchema } from "@/lib/validation/shopkeeper";

const bodySchema = z.object({ reason: z.string().trim().max(300).optional() });

/**
 * DELETE /api/admin/deals/:id — { reason? }: a running deal is taken down
 * (reason required, shown to the shop); an ended one is deleted permanently.
 */
export const DELETE = apiHandler(async (req, ctx: RouteContext<"/api/admin/deals/[id]">) => {
  const admin = await requireApiUser(["admin"]);
  const { reason } = await parseBody(req, bodySchema);
  return json({ result: await adminRemoveOrDeleteDeal(admin, objectIdSchema.parse((await ctx.params).id), reason || undefined) });
});
