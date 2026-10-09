"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api/client";

export function FavoriteButton({ shopId, initial }: { shopId: string; initial: boolean }) {
  const router = useRouter();
  const [favorite, setFavorite] = useState(initial);
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    const next = !favorite;
    setFavorite(next); // optimistic
    const result = next
      ? await apiRequest("/api/customer/favorites", { body: { shopId } })
      : await apiRequest(`/api/customer/favorites/${shopId}`, { method: "DELETE" });
    if (!result.ok) setFavorite(!next);
    setPending(false);
    router.refresh();
  }

  return (
    <Button variant="secondary" size="sm" onClick={toggle} disabled={pending} aria-pressed={favorite}>
      <span aria-hidden className={favorite ? "text-danger" : undefined}>
        {favorite ? "♥" : "♡"}
      </span>
      {favorite ? "Saved" : "Save shop"}
    </Button>
  );
}
