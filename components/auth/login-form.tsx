"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api/client";
import { postLoginPath, safeNextPath, type UserRole } from "@/lib/auth/roles";
import { FormError } from "./form-error";

export function LoginForm() {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const result = await apiRequest<{ user: { role: UserRole } }>("/api/auth/login", {
      body: { email: form.get("email"), password: form.get("password") },
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
      <FormError message={error} />
      <Field label="Email" error={fieldErrors.email?.[0]}>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" required />}
      </Field>
      <Field label="Password" error={fieldErrors.password?.[0]}>
        {(p) => <Input {...p} name="password" type="password" autoComplete="current-password" required />}
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Logging in…" : "Log in"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Forgot your password? Contact the Aqua team and we&apos;ll send you a reset link.
      </p>
      <p className="text-center text-sm text-muted-foreground">
        New to Aqua?{" "}
        <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
