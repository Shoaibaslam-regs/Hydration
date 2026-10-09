import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { clientIp, rateLimit } from "@/lib/api/rate-limit";
import { DASHBOARD_PATH } from "@/lib/auth/roles";
import { createSession } from "@/lib/auth/session";
import { registerUser } from "@/lib/services/users";
import { registerSchema } from "@/lib/validation/auth";

/** POST /api/auth/register — create a customer or shopkeeper account and sign in. */
export const POST = apiHandler(async (req) => {
  await rateLimit(`register:${clientIp(req)}`, 10, 60 * 60 * 1000);
  const input = await parseBody(req, registerSchema);
  const user = await registerUser(input);
  await createSession(user);
  return json(
    {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      redirectTo: DASHBOARD_PATH[user.role],
    },
    201,
  );
});
