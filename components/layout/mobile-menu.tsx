"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { NAV_LINKS } from "./nav-links";

/** `auth` is server-rendered (login buttons or account links) and passed in as a slot. */
export function MobileMenu({ auth }: { auth: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        className={buttonClasses({ variant: "ghost", size: "sm", className: "md:hidden" })}
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {open && (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="glass-panel-solid absolute inset-x-0 top-16 z-50 border-y md:hidden"
        >
          <Container className="flex flex-col gap-1 py-3">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} onClick={close} className="rounded-lg px-3 py-2 font-medium hover:bg-muted">
                {link.label}
              </Link>
            ))}
            {/* Close when any link/button inside the auth slot is used. */}
            <div className="mt-2" onClick={close}>
              {auth}
            </div>
          </Container>
        </nav>
      )}
    </>
  );
}
