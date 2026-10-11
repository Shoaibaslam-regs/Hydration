import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { deleteReviewAsAdmin } from "@/lib/services/reviews";
import { reasonSchema } from "@/lib/validation/ads";
import { objectIdSchema } from "@/lib/validation/shopkeeper";

/** DELETE /api/admin/reviews/:id — { reason }: remove a review (the shop's rating is recalculated). */
export const DELETE = apiHandler(async (req, ctx: RouteContext<"/api/admin/reviews/[id]">) => {
  const admin = await requireApiUser(["admin"]);
  const { reason } = await parseBody(req, reasonSchema);
  await deleteReviewAsAdmin(admin, objectIdSchema.parse((await ctx.params).id), reason);
  return json({ ok: true });
});
