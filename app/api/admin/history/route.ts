import { z } from "zod";
import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { clearAdminActions } from "@/lib/services/admin/audit";
import { objectIdSchema } from "@/lib/validation/shopkeeper";

const clearSchema = z.object({
  targetType: z.enum(["shop", "user", "order", "platform"]),
  targetId: objectIdSchema.nullable().default(null),
});

/** DELETE /api/admin/history — { targetType, targetId }: clear one page's admin history. */
export const DELETE = apiHandler(async (req) => {
  const admin = await requireApiUser(["admin"]);
  const { targetType, targetId } = await parseBody(req, clearSchema);
  return json({ removed: await clearAdminActions(admin, targetType, targetId) });
});
