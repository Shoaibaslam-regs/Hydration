import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { apiHandler, fieldErrorsByPath, json, parseBody } from "@/lib/api/handler";
import { clientIp, failureLock, rateLimit } from "@/lib/api/rate-limit";
import { AUTH_LOCK_MINUTES, AUTH_LOCKED_MESSAGE, AUTH_MAX_FAILURES, attemptsLeftNote } from "@/lib/auth/attempts";
import { DASHBOARD_PATH } from "@/lib/auth/roles";
import { createSession } from "@/lib/auth/session";
import { registerUser } from "@/lib/services/users";
import { registerSchema } from "@/lib/validation/auth";

const LOCK_MS = AUTH_LOCK_MINUTES * 60 * 1000;

/**
 * POST /api/auth/register — create a customer or shopkeeper account and sign in.
 *
 * Rejected attempts (invalid details, an email that's already registered)
 * count as failures: after AUTH_MAX_FAILURES from one IP it's locked for
 * AUTH_LOCK_MINUTES. The hourly cap still limits how many accounts one IP can open.
 */
export const POST = apiHandler(async (req) => {
  const ip = clientIp(req);
  const lockKey = `register:${ip}`;
  await failureLock.check(lockKey, AUTH_MAX_FAILURES, AUTH_LOCKED_MESSAGE);
  await rateLimit(`register:${ip}`, 10, 60 * 60 * 1000);

  let user;
  try {
    user = await registerUser(await parseBody(req, registerSchema));
  } catch (err) {
    const rejected = err instanceof z.ZodError || (err instanceof ApiError && err.status >= 400 && err.status < 413 && err.status !== 401);
    if (!rejected) throw err;
    const { attemptsLeft, lockedForSeconds } = await failureLock.record(lockKey, AUTH_MAX_FAILURES, LOCK_MS);
    if (lockedForSeconds) throw ApiError.rateLimited(lockedForSeconds, AUTH_LOCKED_MESSAGE);
    // Keep the field errors so the form still shows what to fix, and say how many tries are left.
    const note = attemptsLeftNote(attemptsLeft);
    if (err instanceof z.ZodError) {
      throw new ApiError(400, "VALIDATION_ERROR", `Please fix the highlighted fields. ${note}`, { ...fieldErrorsByPath(err), attemptsLeft });
    }
    const e = err as ApiError;
    throw new ApiError(e.status, e.code, `${e.message}. ${note}`.replace("..", "."), { ...(e.details as object | undefined), attemptsLeft });
  }

  await createSession(user);
  return json(
    {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      redirectTo: DASHBOARD_PATH[user.role],
    },
    201,
  );
});
