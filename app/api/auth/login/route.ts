import { ApiError } from "@/lib/api/errors";
import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { clientIp, rateLimit } from "@/lib/api/rate-limit";
import { DASHBOARD_PATH } from "@/lib/auth/roles";
import { createSession } from "@/lib/auth/session";
import { authenticate } from "@/lib/services/users";
import { loginSchema } from "@/lib/validation/auth";

const WINDOW_MS = 15 * 60 * 1000;

/** POST /api/auth/login */
export const POST = apiHandler(async (req) => {
  const ip = clientIp(req);
  rateLimit(`login-ip:${ip}`, 50, WINDOW_MS);
  const input = await parseBody(req, loginSchema);
  rateLimit(`login:${ip}:${input.email}`, 10, WINDOW_MS);

  const user = await authenticate(input);
  if (!user) throw ApiError.unauthorized("Incorrect email or password");

  await createSession(user);
  return json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    redirectTo: DASHBOARD_PATH[user.role],
  });
});
