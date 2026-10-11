import { apiHandler, json } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { deleteAdminAction } from "@/lib/services/admin/audit";
import { objectIdSchema } from "@/lib/validation/shopkeeper";

/** DELETE /api/admin/history/:id — delete one admin history entry. */
export const DELETE = apiHandler(async (_req, ctx: RouteContext<"/api/admin/history/[id]">) => {
  await requireApiUser(["admin"]);
  await deleteAdminAction(objectIdSchema.parse((await ctx.params).id));
  return json({ ok: true });
});
