import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { deleteBanner, updateBanner } from "@/lib/services/ads/banners";
import { bannerInputSchema } from "@/lib/validation/ads";
import { objectIdSchema } from "@/lib/validation/shopkeeper";

type Ctx = RouteContext<"/api/admin/banners/[id]">;

/** PUT /api/admin/banners/:id */
export const PUT = apiHandler(async (req, ctx: Ctx) => {
  const admin = await requireApiUser(["admin"]);
  await updateBanner(admin, objectIdSchema.parse((await ctx.params).id), await parseBody(req, bannerInputSchema));
  return json({ ok: true });
});

/** DELETE /api/admin/banners/:id */
export const DELETE = apiHandler(async (_req, ctx: Ctx) => {
  const admin = await requireApiUser(["admin"]);
  await deleteBanner(admin, objectIdSchema.parse((await ctx.params).id));
  return json({ ok: true });
});
