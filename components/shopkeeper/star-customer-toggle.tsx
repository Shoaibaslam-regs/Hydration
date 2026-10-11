"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRequest } from "@/lib/api/client";
import { cn } from "@/lib/utils";

/** Tag (or untag) this order's customer as one of the shop's Star customers. */
export function StarCustomerToggle({ orderId, initial }: { orderId: string; initial: boolean }) {
  const router = useRouter();
  const [star, setStar] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setPending(true);
    setError(null);
    const result = await apiRequest(`/api/shopkeeper/orders/${orderId}/star`, { method: "PUT", body: { star: !star } });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setStar(!star);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={star}
        className={cn(
          "inline-flex items-center gap-1.5 self-start rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-60",
          star ? "border-award bg-award text-award-foreground" : "border-award/40 bg-award-soft text-award hover:border-award",
        )}
      >
        <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden>
          <path
            fill={star ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"
          />
        </svg>
        {star ? "Star customer" : "Mark as star customer"}
      </button>
      <p className="text-xs text-muted-foreground">
        {star ? "They see the tag on their account. Tap to remove it." : "For your regulars. They'll see the tag on their account."}
      </p>
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
