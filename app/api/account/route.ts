import { z } from "zod";
import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { deleteSession, requireApiUser } from "@/lib/auth/session";
import { deleteMyAccount } from "@/lib/services/admin/user-removal";

const schema = z.object({ password: z.string().min(1, "Enter your password").max(200) });

/** DELETE /api/account — { password }: a customer or shopkeeper deletes their own account, then is signed out. */
export const DELETE = apiHandler(async (req) => {
  const user = await requireApiUser(["customer", "shopkeeper"]);
  await rateLimit(`delete-account:${user.id}`, 5, 15 * 60 * 1000);
  const { password } = await parseBody(req, schema);
  const result = await deleteMyAccount(user, password);
  await deleteSession();
  return json(result);
});
