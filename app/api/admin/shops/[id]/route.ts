import { ApiError } from "@/lib/api/errors";
import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { adminRemoveShop, getAdminShop, setShopStatus } from "@/lib/services/admin/shops";
import { adminShopRemoveSchema, adminShopStatusSchema } from "@/lib/validation/admin";
import { objectIdSchema } from "@/lib/validation/shopkeeper";

type Ctx = RouteContext<"/api/admin/shops/[id]">;

/** GET /api/admin/shops/:id */
export const GET = apiHandler(async (_req, ctx: Ctx) => {
  await requireApiUser(["admin"]);
  const shop = await getAdminShop(objectIdSchema.parse((await ctx.params).id));
  if (!shop) throw ApiError.notFound("Shop not found");
  return json(shop);
});

/** PATCH /api/admin/shops/:id — { status, reason? } (reason required to reject/suspend) */
export const PATCH = apiHandler(async (req, ctx: Ctx) => {
  const admin = await requireApiUser(["admin"]);
  const id = objectIdSchema.parse((await ctx.params).id);
  const { status, reason } = await parseBody(req, adminShopStatusSchema);
  await setShopStatus(admin, id, status, reason);
  return json(await getAdminShop(id));
});

/** DELETE /api/admin/shops/:id — { reason }: remove the shop permanently (cancels its unfinished orders). */
export const DELETE = apiHandler(async (req, ctx: Ctx) => {
  const admin = await requireApiUser(["admin"]);
  const id = objectIdSchema.parse((await ctx.params).id);
  const { reason } = await parseBody(req, adminShopRemoveSchema);
  return json(await adminRemoveShop(admin, id, reason));
});
