import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { createReview } from "@/lib/services/reviews";
import { reviewInputSchema } from "@/lib/validation/customer";
import { objectIdSchema } from "@/lib/validation/shopkeeper";

/** POST /api/customer/orders/:id/review — one review per delivered order. */
export const POST = apiHandler(async (req, ctx: RouteContext<"/api/customer/orders/[id]/review">) => {
  const user = await requireApiUser(["customer"]);
  const id = objectIdSchema.parse((await ctx.params).id);
  await createReview(user, id, await parseBody(req, reviewInputSchema));
  return json({ ok: true }, 201);
});
