"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { apiRequest } from "@/lib/api/client";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, setPending] = useState(false);

  async function logout() {
    const ok = await confirm({ title: "Log out?", message: "You'll need to log in again to use your account on this device.", confirmLabel: "Log out" });
    if (!ok) return;
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
