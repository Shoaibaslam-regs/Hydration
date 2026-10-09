// Session token signing/verification. Used by server code and proxy.ts
// (which must not do DB lookups), so it has no DB or React dependencies.
import { jwtVerify, SignJWT } from "jose";
import { USER_ROLES, type UserRole } from "./roles";

export const SESSION_COOKIE = "aqua_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type SessionClaims = { sub: string; role: UserRole; ver: number };

function key(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("JWT_SECRET must be set (at least 32 characters)");
  return new TextEncoder().encode(secret);
}

export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({ role: claims.role, ver: claims.ver })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(key());
}

/** Returns the claims if the token is valid and unexpired, otherwise null. */
export async function verifySession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    const { sub, role, ver } = payload;
    if (typeof sub !== "string" || typeof ver !== "number" || !USER_ROLES.includes(role as UserRole)) return null;
    return { sub, role: role as UserRole, ver };
  } catch {
    return null;
  }
}
