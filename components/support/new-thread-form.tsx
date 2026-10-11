"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { apiRequest } from "@/lib/api/client";
import {
  MAX_SUPPORT_MESSAGE_LENGTH,
  SUPPORT_CATEGORIES_FOR,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_PATH,
  type SupportUserRole,
} from "@/lib/support/constants";

/** Start a conversation with the Aqua team. Topics depend on who's writing; `compact` fits a dashboard card. */
export function NewSupportThreadForm({ role, compact = false }: { role: SupportUserRole; compact?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const result = await apiRequest<{ id: string }>("/api/support", {
      body: { category: f.get("category"), subject: f.get("subject"), body: f.get("body") },
    });
    if (!result.ok) {
      setPending(false);
      setError(result.message);
      setFieldErrors(result.fieldErrors);
      return;
    }
    router.push(`${SUPPORT_PATH[role]}/${result.data.id}?sent=1`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <FormError message={error} />
      <div className={compact ? "grid gap-3 sm:grid-cols-2" : "grid gap-3 sm:grid-cols-[14rem_1fr]"}>
        <Field label="About" error={fieldErrors.category?.[0]}>
          {(p) => (
            <Select {...p} name="category" defaultValue="other">
              {SUPPORT_CATEGORIES_FOR[role].map((c) => (
                <option key={c} value={c}>
                  {SUPPORT_CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Subject" error={fieldErrors.subject?.[0]}>
          {(p) => <Input {...p} name="subject" maxLength={120} placeholder={role === "customer" ? "e.g. My order didn't arrive" : "e.g. My payment isn't showing"} required />}
        </Field>
      </div>
      <Field label="Message" error={fieldErrors.body?.[0]}>
        {(p) => (
          <Textarea
            {...p}
            name="body"
            rows={compact ? 3 : 5}
            maxLength={MAX_SUPPORT_MESSAGE_LENGTH}
            placeholder={
              role === "customer"
                ? "Tell us what's happening. Include the order number and shop name if it's about an order."
                : "Tell us what's happening. Include order numbers or payment references if you have them."
            }
            required
          />
        )}
      </Field>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Sending…" : "Send to Aqua team"}
      </Button>
    </form>
  );
}
