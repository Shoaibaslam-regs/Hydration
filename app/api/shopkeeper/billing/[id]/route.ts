import { apiHandler, json } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { deleteMyPayment } from "@/lib/services/billing";
import { requireMyShop } from "@/lib/services/my-shop";
import { objectIdSchema } from "@/lib/validation/shopkeeper";

/** DELETE /api/shopkeeper/billing/:id — cancel a pending payment or delete a rejected one. */
export const DELETE = apiHandler(async (_req, ctx: RouteContext<"/api/shopkeeper/billing/[id]">) => {
  const user = await requireApiUser(["shopkeeper"]);
  await deleteMyPayment(await requireMyShop(user.id, { allowLocked: true }), objectIdSchema.parse((await ctx.params).id));
  return json({ ok: true });
});
