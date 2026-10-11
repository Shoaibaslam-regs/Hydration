import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { deleteSupportThread, replyAsAdmin, setSupportThreadStatusAsAdmin } from "@/lib/services/support";
import { objectIdSchema } from "@/lib/validation/shopkeeper";
import { supportReplySchema, supportStatusSchema } from "@/lib/validation/support";

type Ctx = RouteContext<"/api/admin/support/[id]">;

/** POST /api/admin/support/:id — reply as the Aqua team. */
export const POST = apiHandler(async (req, ctx: Ctx) => {
  const admin = await requireApiUser(["admin"]);
  const { body } = await parseBody(req, supportReplySchema);
  await replyAsAdmin(admin, objectIdSchema.parse((await ctx.params).id), body);
  return json({ ok: true }, 201);
});

/** PATCH /api/admin/support/:id — { status: "open" | "closed" } */
export const PATCH = apiHandler(async (req, ctx: Ctx) => {
  await requireApiUser(["admin"]);
  const { status } = await parseBody(req, supportStatusSchema);
  await setSupportThreadStatusAsAdmin(objectIdSchema.parse((await ctx.params).id), status);
  return json({ ok: true });
});

/** DELETE /api/admin/support/:id — delete the conversation permanently. */
export const DELETE = apiHandler(async (_req, ctx: Ctx) => {
  const admin = await requireApiUser(["admin"]);
  await deleteSupportThread(admin, objectIdSchema.parse((await ctx.params).id));
  return json({ ok: true });
});
