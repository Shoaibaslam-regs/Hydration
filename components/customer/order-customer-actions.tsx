"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import { apiRequest } from "@/lib/api/client";
import { cn } from "@/lib/utils";

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    if (!confirm("Cancel this order?")) return;
    setPending(true);
    const result = await apiRequest(`/api/customer/orders/${orderId}/cancel`, { body: {} });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <FormError message={error} />
      <Button variant="secondary" onClick={cancel} disabled={pending} className="self-start text-danger">
        {pending ? "Cancelling…" : "Cancel order"}
      </Button>
    </div>
  );
}

export function ReviewForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError("Choose a rating from 1 to 5 stars.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await apiRequest(`/api/customer/orders/${orderId}/review`, { body: { rating, comment } });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <FormError message={error} />
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Your rating</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer">
              <input type="radio" name="rating" value={n} className="sr-only" checked={rating === n} onChange={() => setRating(n)} />
              <span
                aria-hidden
                className={cn("text-3xl leading-none", n <= rating ? "text-warning" : "text-border hover:text-warning/60")}
              >
                ★
              </span>
              <span className="sr-only">{n} star{n > 1 && "s"}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Comment (optional)">
        {(p) => <Textarea {...p} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />}
      </Field>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Posting…" : "Post review"}
      </Button>
    </form>
  );
}
