"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { apiRequest } from "@/lib/api/client";
import { SUSPENSION_DAYS } from "@/lib/auth/suspension";

/** Suspend for a chosen period (or until lifted), with a reason. */
export function SuspendUserForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<string>("7");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    const result = await apiRequest(`/api/admin/users/${userId}`, {
      method: "PATCH",
      body: { action: "suspend", reason: reason.trim(), days: days === "indefinite" ? null : Number(days) },
    });
    setPending(false);
    if (!result.ok) {
      setError(result.fieldErrors.reason?.[0] ?? result.message);
      return;
    }
    setOpen(false);
    setReason("");
    router.refresh();
  }

  if (!open) {
    return (
      <Button variant="danger-outline" onClick={() => setOpen(true)}>
        Suspend account…
      </Button>
    );
  }
  return (
    <div className="flex w-full flex-col gap-3 rounded-lg border border-border p-3">
      <FormError message={error} />
      <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
        <Field label="Suspend for">
          {(p) => (
            <Select {...p} value={days} onChange={(e) => setDays(e.target.value)}>
              {SUSPENSION_DAYS.map((d) => (
                <option key={d} value={d}>
                  {d} {d === 1 ? "day" : "days"}
                </option>
              ))}
              <option value="indefinite">Until I lift it</option>
            </Select>
          )}
        </Field>
        <Field label="Reason" hint="Kept in the admin history.">
          {(p) => <Input {...p} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} autoFocus />}
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="danger" onClick={submit} disabled={pending || reason.trim() === ""}>
          {pending ? "Suspending…" : "Suspend"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** Permanent deletion, guarded by typing the user's email. */
export function DeleteUser({ userId, email }: { userId: string; email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  async function remove() {
    setPending(true);
    setError(null);
    const result = await apiRequest(`/api/admin/users/${userId}`, { method: "DELETE", body: { confirmEmail: typed, reason } });
    if (!result.ok) {
      setPending(false);
      setError(result.fieldErrors.confirmEmail?.[0] ?? result.fieldErrors.reason?.[0] ?? result.message);
      return;
    }
    router.push("/admin/users");
    router.refresh();
  }

  if (!open) {
    return (
      <Button variant="danger-outline" className="self-start" onClick={() => setOpen(true)}>
        Delete account…
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <FormError message={error} />
      <Field label="Reason" hint="Kept in the admin history.">
        {(p) => <Input {...p} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} autoFocus />}
      </Field>
      <Field label={`Type ${email} to confirm`}>
        {(p) => <Input {...p} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />}
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button variant="danger" onClick={remove} disabled={!matches || reason.trim() === "" || pending}>
          {pending ? "Deleting…" : "Delete account permanently"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
