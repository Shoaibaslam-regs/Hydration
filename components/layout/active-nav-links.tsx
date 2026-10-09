"use client";

import { usePathname } from "next/navigation";
import { NavLinks } from "./nav-links";

/** Highlights the current section. Reads the URL, so render it inside <Suspense>. */
export function ActiveNavLinks() {
  return <NavLinks activePath={usePathname()} />;
}
