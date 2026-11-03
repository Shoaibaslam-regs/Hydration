import { ApiError } from "@/lib/api/errors";
import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { clientIp, failureLock, rateLimit } from "@/lib/api/rate-limit";
import { AUTH_LOCK_MINUTES, AUTH_LOCKED_MESSAGE, AUTH_MAX_FAILURES, attemptsLeftNote } from "@/lib/auth/attempts";
import { DASHBOARD_PATH } from "@/lib/auth/roles";
import { createSession } from "@/lib/auth/session";
import { authenticate } from "@/lib/services/users";
import { loginSchema } from "@/lib/validation/auth";

const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = AUTH_LOCK_MINUTES * 60 * 1000;

/**
 * POST /api/auth/login
 *
 * After AUTH_MAX_FAILURES wrong passwords from one IP, that IP is locked for
 * AUTH_LOCK_MINUTES (429 with the seconds left). A successful login clears
 * the count. The per-account limit stays because X-Forwarded-For can be
 * spoofed, so an IP lock alone doesn't stop guessing against one account.
 */
export const POST = apiHandler(async (req) => {
  const ip = clientIp(req);
  const lockKey = `login:${ip}`;
  await failureLock.check(lockKey, AUTH_MAX_FAILURES, AUTH_LOCKED_MESSAGE);
  await rateLimit(`login-ip:${ip}`, 50, WINDOW_MS);
  const input = await parseBody(req, loginSchema);
  await rateLimit(`login-account:${input.email}`, 30, WINDOW_MS);

  const user = await authenticate(input);
  if (!user) {
    const { attemptsLeft, lockedForSeconds } = await failureLock.record(lockKey, AUTH_MAX_FAILURES, LOCK_MS);
    if (lockedForSeconds) throw ApiError.rateLimited(lockedForSeconds, AUTH_LOCKED_MESSAGE);
    throw new ApiError(401, "UNAUTHORIZED", `Incorrect email or password. ${attemptsLeftNote(attemptsLeft)}`, { attemptsLeft });
  }

  await failureLock.clear(lockKey);
  await createSession(user);
  return json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    redirectTo: DASHBOARD_PATH[user.role],
  });
});
