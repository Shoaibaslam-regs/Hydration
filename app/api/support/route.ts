import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { requireApiUser } from "@/lib/auth/session";
import { createSupportThread } from "@/lib/services/support";
import { supportThreadCreateSchema } from "@/lib/validation/support";

/** POST /api/support — a customer or shopkeeper starts a conversation with the Aqua team. */
export const POST = apiHandler(async (req) => {
  const user = await requireApiUser(["customer", "shopkeeper"]);
  return json({ id: await createSupportThread(user, await parseBody(req, supportThreadCreateSchema)) }, 201);
});
