"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api/client";
import { FormError } from "./form-error";

export function ResetPasswordForm({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("password") !== f.get("confirm")) {
      setFieldErrors({ confirm: ["Passwords don't match"] });
      return;
    }
    setPending(true);
    setError(null);
    const result = await apiRequest("/api/auth/reset-password", { body: { token, password: f.get("password") } });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      setFieldErrors(result.fieldErrors);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm">
          Your password has been changed. Log in with your new password.
        </p>
        <Link href="/login" className={buttonClasses({ size: "lg" })}>
          Log in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormError message={error} />
      <Field label="New password" hint="At least 8 characters." error={fieldErrors.password?.[0]}>
        {(p) => <Input {...p} name="password" type="password" autoComplete="new-password" required minLength={8} />}
      </Field>
      <Field label="Confirm new password" error={fieldErrors.confirm?.[0]}>
        {(p) => <Input {...p} name="confirm" type="password" autoComplete="new-password" required />}
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
