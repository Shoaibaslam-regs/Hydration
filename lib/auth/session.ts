import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { ApiError } from "@/lib/api/errors";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySession } from "./jwt";
import { DASHBOARD_PATH, type UserRole } from "./roles";
import { isSuspended } from "./suspension";

/** The signed-in user as exposed to app code and the browser. */
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export async function createSession(user: { id: string; role: UserRole; sessionVersion: number }) {
  const token = await signSession({ sub: user.id, role: user.role, ver: user.sessionVersion });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function deleteSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * Current user, verified against the database on every request (so suspensions,
 * role changes and session revocation apply immediately). Deduplicated per
 * request. Reads cookies: call it inside <Suspense> in pages.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  // Token expiry checks read the clock and the user lookup hits the DB:
  // both must run per request, never in a prefetch prerender.
  await connection();
  const claims = await verifySession(token);
  if (!claims) return null;

  await connectDB();
  const user = await User.findById(claims.sub, { name: 1, email: 1, role: 1, status: 1, suspendedUntil: 1, sessionVersion: 1 }).lean();
  if (!user || isSuspended(user, new Date()) || user.sessionVersion !== claims.ver) return null;

  return { id: user._id.toString(), name: user.name, email: user.email, role: user.role as UserRole };
});

/** For pages: the signed-in user with one of `roles`, else redirect (to login, or to their own dashboard). */
export async function requireRole(roles: UserRole[], currentPath: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(currentPath)}`);
  if (!roles.includes(user.role)) redirect(DASHBOARD_PATH[user.role]);
  return user;
}

/** For Route Handlers: the signed-in user (optionally with one of `roles`), else 401/403. */
export async function requireApiUser(roles?: UserRole[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw ApiError.unauthorized();
  if (roles && !roles.includes(user.role)) throw ApiError.forbidden();
  return user;
}
