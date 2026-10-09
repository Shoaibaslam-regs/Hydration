import { apiHandler, json } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { createResetToken } from "@/lib/services/password-reset";
import { objectIdSchema } from "@/lib/validation/shopkeeper";

/** POST /api/admin/users/:id/reset-link — a one-time link (1 hour) to send to the user. */
export const POST = apiHandler(async (req, ctx: RouteContext<"/api/admin/users/[id]/reset-link">) => {
  const admin = await requireApiUser(["admin"]);
  const { token, expiresAt } = await createResetToken(admin, objectIdSchema.parse((await ctx.params).id));
  const url = new URL(`/reset-password?token=${token}`, req.nextUrl.origin).toString();
  return json({ url, expiresAt }, 201);
});
