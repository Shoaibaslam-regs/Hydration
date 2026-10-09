import { ApiError } from "@/lib/api/errors";
import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { getAdminUser, updateAdminUser } from "@/lib/services/admin/users";
import { adminUserUpdateSchema } from "@/lib/validation/admin";
import { objectIdSchema } from "@/lib/validation/shopkeeper";

type Ctx = RouteContext<"/api/admin/users/[id]">;

/** GET /api/admin/users/:id */
export const GET = apiHandler(async (_req, ctx: Ctx) => {
  await requireApiUser(["admin"]);
  const user = await getAdminUser(objectIdSchema.parse((await ctx.params).id));
  if (!user) throw ApiError.notFound("User not found");
  return json(user);
});

/** PATCH /api/admin/users/:id — { action: "suspend", reason } | { action: "activate" } | { action: "signOutEverywhere" } */
export const PATCH = apiHandler(async (req, ctx: Ctx) => {
  const admin = await requireApiUser(["admin"]);
  const id = objectIdSchema.parse((await ctx.params).id);
  await updateAdminUser(admin, id, await parseBody(req, adminUserUpdateSchema));
  return json(await getAdminUser(id));
});
