import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { startSupportThreadAsAdmin } from "@/lib/services/support";
import { adminSupportStartSchema } from "@/lib/validation/support";

/** POST /api/admin/support — { userId, subject, body }: the team messages a customer or shopkeeper. */
export const POST = apiHandler(async (req) => {
  const admin = await requireApiUser(["admin"]);
  const { userId, ...input } = await parseBody(req, adminSupportStartSchema);
  return json({ id: await startSupportThreadAsAdmin(admin, userId, input) }, 201);
});
