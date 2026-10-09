// Role constants and redirect helpers. Safe for client and proxy code.

export const USER_ROLES = ["customer", "shopkeeper", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Roles a visitor may pick when signing up. Admins are created via `npm run user:create-admin`. */
export const SELF_SERVICE_ROLES = ["customer", "shopkeeper"] as const satisfies readonly UserRole[];

export const DASHBOARD_PATH: Record<UserRole, string> = {
  customer: "/account",
  shopkeeper: "/shop",
  admin: "/admin",
};

/** Which role may access a dashboard path, or null if the path isn't a dashboard. */
export function roleForPath(pathname: string): UserRole | null {
  for (const [role, base] of Object.entries(DASHBOARD_PATH) as [UserRole, string][]) {
    if (pathname === base || pathname.startsWith(`${base}/`)) return role;
  }
  return null;
}

/** Only allow same-site relative paths, to prevent open redirects via `?next=`. */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

/** Where to send a user after login: `next` if it's safe and allowed for their role, else their dashboard. */
export function postLoginPath(role: UserRole, next: string | null | undefined): string {
  const safe = safeNextPath(next);
  if (safe) {
    const required = roleForPath(new URL(safe, "http://x").pathname);
    if (required === null || required === role) return safe;
  }
  return DASHBOARD_PATH[role];
}
