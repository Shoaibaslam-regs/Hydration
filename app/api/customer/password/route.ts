import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { createSession, requireApiUser } from "@/lib/auth/session";
import { changePassword } from "@/lib/services/users";
import { passwordChangeSchema } from "@/lib/validation/customer";

/** POST /api/customer/password — signs out every other device. */
export const POST = apiHandler(async (req) => {
  const user = await requireApiUser(["customer"]);
  await rateLimit(`password:${user.id}`, 10, 15 * 60 * 1000);
  const { currentPassword, newPassword } = await parseBody(req, passwordChangeSchema);
  const updated = await changePassword(user.id, currentPassword, newPassword);
  await createSession(updated);
  return json({ ok: true });
});
