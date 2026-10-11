import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { createSupportThread } from "@/lib/services/support";
import { supportThreadCreateSchema } from "@/lib/validation/support";

/** POST /api/shopkeeper/support — start a conversation with the Aqua team. */
export const POST = apiHandler(async (req) => {
  const user = await requireApiUser(["shopkeeper"]);
  return json({ id: await createSupportThread(user, await parseBody(req, supportThreadCreateSchema)) }, 201);
});
