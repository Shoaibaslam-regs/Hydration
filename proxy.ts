import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/jwt";
import { DASHBOARD_PATH, roleForPath } from "@/lib/auth/roles";

/**
 * Optimistic redirects for dashboards, based only on the signed cookie (no DB).
 * Real authorization happens in pages (requireRole) and Route Handlers
 * (requireApiUser), which also check the user's current DB state.
 */
export default async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const requiredRole = roleForPath(pathname);
  if (!requiredRole) return NextResponse.next();

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const login = new URL("/login", req.nextUrl);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }
  if (session.role !== requiredRole) {
    return NextResponse.redirect(new URL(DASHBOARD_PATH[session.role], req.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/shop/:path*", "/admin/:path*"],
};
