"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api/client";
import { postLoginPath, safeNextPath, type UserRole } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { FormError } from "./form-error";

const ROLE_OPTIONS = [
  { value: "customer", title: "I want to order water", body: "Find shops nearby and get water delivered." },
  { value: "shopkeeper", title: "I run a water shop", body: "List your shop and take orders online." },
] as const;

export function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const [role, setRole] = useState<"customer" | "shopkeeper">(
    params.get("role") === "shopkeeper" ? "shopkeeper" : "customer",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const result = await apiRequest<{ user: { role: UserRole } }>("/api/auth/register", {
      body: {
        role,
        name: form.get("name"),
        email: form.get("email"),
        phone: form.get("phone"),
        password: form.get("password"),
      },
    });
    if (!result.ok) {
      setPending(false);
      setError(result.message);
      setFieldErrors(result.fieldErrors);
      return;
    }
    router.replace(postLoginPath(result.data.user.role, next));
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium">Account type</legend>
        {ROLE_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={cn(
              "flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 text-sm transition-colors",
              role === opt.value ? "border-primary bg-accent" : "border-border hover:bg-muted",
            )}
          >
            <span className="flex items-center gap-2 font-medium">
              <input
                type="radio"
                name="role"
                value={opt.value}
                checked={role === opt.value}
                onChange={() => setRole(opt.value)}
                className="accent-[var(--primary)]"
              />
              {opt.title}
            </span>
            <span className="text-muted-foreground">{opt.body}</span>
          </label>
        ))}
      </fieldset>

      <FormError message={error} />
      <Field label={role === "shopkeeper" ? "Your name (shop owner)" : "Full name"} error={fieldErrors.name?.[0]}>
        {(p) => <Input {...p} name="name" autoComplete="name" required maxLength={80} />}
      </Field>
      <Field label="Email" error={fieldErrors.email?.[0]}>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" required />}
      </Field>
      <Field label="Phone (optional)" error={fieldErrors.phone?.[0]}>
        {(p) => <Input {...p} name="phone" type="tel" autoComplete="tel" />}
      </Field>
      <Field label="Password" hint="At least 8 characters." error={fieldErrors.password?.[0]}>
        {(p) => <Input {...p} name="password" type="password" autoComplete="new-password" required minLength={8} />}
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
