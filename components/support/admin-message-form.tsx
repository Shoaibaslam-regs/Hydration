"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { apiRequest } from "@/lib/api/client";
import { MAX_SUPPORT_MESSAGE_LENGTH, type SupportUserRole } from "@/lib/support/constants";

type Template = { label: string; subject: string; body: string };

const TEMPLATES: Record<SupportUserRole, Template[]> = {
  shopkeeper: [
    {
      label: "★ Star shopkeeper",
      subject: "You're a star shopkeeper!",
      body: "Congratulations! Your customers love your service, and the Aqua team has noticed. Thank you for the fast deliveries and the care you put into every order. Keep it up!",
    },
    {
      label: "Thank you",
      subject: "Thank you from the Aqua team",
      body: "Thank you for being part of Aqua. We appreciate the work you put into serving your customers.",
    },
    {
      label: "Plan reminder",
      subject: "Your plan is ending soon",
      body: "A quick reminder: your Aqua plan is ending soon. Renew it under Billing so customers can keep finding your shop.",
    },
    {
      label: "Customer complaint",
      subject: "About a recent customer complaint",
      body: "We received a complaint from a customer about a recent order. Could you tell us what happened?",
    },
  ],
  customer: [
    {
      label: "Thank you",
      subject: "Thank you for using Aqua",
      body: "Thank you for ordering with Aqua. We're glad to have you with us!",
    },
    {
      label: "About your complaint",
      subject: "About your complaint",
      body: "We've looked into your complaint and spoken to the shop. Here's what we found:",
    },
  ],
};

/**
 * The Aqua team starts a conversation with a customer or shopkeeper. It lands
 * in their support inbox, signed "Aqua team". Templates fill the fields.
 */
export function AdminMessageForm({ userId, role, name }: { userId: string; role: SupportUserRole; name: string }) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await apiRequest<{ id: string }>("/api/admin/support", { body: { userId, subject, body } });
    if (!result.ok) {
      setPending(false);
      setError(result.message);
      setFieldErrors(result.fieldErrors);
      return;
    }
    router.push(`/admin/support/${result.data.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <FormError message={error} />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Start from a template">
        {TEMPLATES[role].map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => {
              setSubject(t.subject);
              setBody(t.body);
            }}
            className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium hover:border-primary hover:text-primary"
          >
            {t.label}
          </button>
        ))}
      </div>
      <Field label="Subject" error={fieldErrors.subject?.[0]}>
        {(p) => <Input {...p} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} required />}
      </Field>
      <Field label="Message" error={fieldErrors.body?.[0]}>
        {(p) => (
          <Textarea
            {...p}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={MAX_SUPPORT_MESSAGE_LENGTH}
            placeholder={`Write to ${name}…`}
            required
          />
        )}
      </Field>
      <p className="text-xs text-muted-foreground">
        It appears in their Contact Aqua inbox, signed &ldquo;Aqua team&rdquo;, and they get a notification.
      </p>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
