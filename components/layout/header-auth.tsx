import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { buttonClasses } from "@/components/ui/button";
import { DASHBOARD_PATH } from "@/lib/auth/roles";
import { getSessionUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

/** Login/signup buttons, or the user's dashboard link + logout. Reads the session: render inside <Suspense>. */
export async function HeaderAuth({ layout }: { layout: "inline" | "stacked" }) {
  const user = await getSessionUser();
  const wrapper = layout === "inline" ? "flex items-center gap-2" : "grid grid-cols-2 gap-2";

  if (!user) {
    return (
      <div className={wrapper}>
        <Link href="/login" className={buttonClasses({ variant: layout === "inline" ? "ghost" : "secondary" })}>
          Log in
        </Link>
        <Link href="/register" className={buttonClasses()}>
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <div className={wrapper}>
      <Link href={DASHBOARD_PATH[user.role]} className={buttonClasses({ variant: "secondary" })}>
        <span className={cn("truncate", layout === "inline" && "max-w-32")}>
          {user.role === "customer" ? "My account" : "Dashboard"}
        </span>
      </Link>
      <LogoutButton />
    </div>
  );
}

export function HeaderAuthSkeleton({ layout }: { layout: "inline" | "stacked" }) {
  return (
    <div className={layout === "inline" ? "flex gap-2" : "grid grid-cols-2 gap-2"} aria-hidden>
      <div className="h-10 w-20 animate-pulse rounded-lg bg-muted" />
      <div className="h-10 w-20 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
