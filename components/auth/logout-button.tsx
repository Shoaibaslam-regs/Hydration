"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api/client";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await apiRequest("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  }

  return (
    <Button variant="ghost" onClick={logout} disabled={pending} className={className}>
      {pending ? "Logging out…" : "Log out"}
    </Button>
  );
}
