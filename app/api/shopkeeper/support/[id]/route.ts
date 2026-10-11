import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { hideMySupportThread, replyAsShopkeeper, setMySupportThreadStatus } from "@/lib/services/support";
import { objectIdSchema } from "@/lib/validation/shopkeeper";
import { supportReplySchema, supportStatusSchema } from "@/lib/validation/support";

type Ctx = RouteContext<"/api/shopkeeper/support/[id]">;

/** POST /api/shopkeeper/support/:id — reply in your own conversation. */
export const POST = apiHandler(async (req, ctx: Ctx) => {
  const user = await requireApiUser(["shopkeeper"]);
  const { body } = await parseBody(req, supportReplySchema);
  await replyAsShopkeeper(user, objectIdSchema.parse((await ctx.params).id), body);
  return json({ ok: true }, 201);
});

/** PATCH /api/shopkeeper/support/:id — { status: "open" | "closed" } */
export const PATCH = apiHandler(async (req, ctx: Ctx) => {
  const user = await requireApiUser(["shopkeeper"]);
  const { status } = await parseBody(req, supportStatusSchema);
  await setMySupportThreadStatus(user.id, objectIdSchema.parse((await ctx.params).id), status);
  return json({ ok: true });
});

/** DELETE /api/shopkeeper/support/:id — delete the conversation from your list. */
export const DELETE = apiHandler(async (_req, ctx: Ctx) => {
  const user = await requireApiUser(["shopkeeper"]);
  await hideMySupportThread(user.id, objectIdSchema.parse((await ctx.params).id));
  return json({ ok: true });
});
