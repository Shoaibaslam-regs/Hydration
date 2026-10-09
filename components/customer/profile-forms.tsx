"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api/client";

type Errors = Record<string, string[] | undefined>;

export function ProfileForm({ name, phone }: { name: string; phone: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Errors>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setSaved(false);
    setError(null);
    const f = new FormData(e.currentTarget);
    const result = await apiRequest("/api/customer/profile", {
      method: "PATCH",
      body: { name: f.get("name"), phone: f.get("phone") },
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormError message={error} />
      <Field label="Full name" error={fieldErrors.name?.[0]}>
        {(p) => <Input {...p} name="name" defaultValue={name} autoComplete="name" required maxLength={80} />}
      </Field>
      <Field label="Phone" hint="Pre-filled at checkout." error={fieldErrors.phone?.[0]}>
        {(p) => <Input {...p} name="phone" type="tel" defaultValue={phone} autoComplete="tel" />}
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {saved && (
          <span role="status" className="text-sm text-success">
            Saved.
          </span>
        )}
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Errors>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setPending(true);
    setDone(false);
    setError(null);
    const f = new FormData(form);
    const result = await apiRequest("/api/customer/password", {
      body: { currentPassword: f.get("currentPassword"), newPassword: f.get("newPassword") },
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      setFieldErrors(result.fieldErrors);
      return;
    }
    form.reset();
    setFieldErrors({});
    setDone(true);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormError message={error} />
      <Field label="Current password" error={fieldErrors.currentPassword?.[0]}>
        {(p) => <Input {...p} name="currentPassword" type="password" autoComplete="current-password" required />}
      </Field>
      <Field label="New password" hint="At least 8 characters." error={fieldErrors.newPassword?.[0]}>
        {(p) => <Input {...p} name="newPassword" type="password" autoComplete="new-password" required minLength={8} />}
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Updating…" : "Change password"}
        </Button>
        {done && (
          <span role="status" className="text-sm text-success">
            Password changed. Other devices have been signed out.
          </span>
        )}
      </div>
    </form>
  );
}
