"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Field, Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api/client";

/** "Delete my account" for customers and shopkeepers: password, then a final confirmation. */
export function DeleteAccount({ role }: { role: "customer" | "shopkeeper" }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const consequences =
    role === "shopkeeper"
      ? "Your shop, its deals and reviews are removed, unfinished orders are cancelled, and your support messages are deleted. Plan payment records are kept by Aqua."
      : "Your addresses, reviews and saved shops are deleted, and unfinished orders are cancelled. Shops keep past orders without your name, phone or street address.";

  async function remove() {
    const ok = await confirm({
      title: "Delete your account permanently?",
      message: `${consequences} This can't be undone.`,
      confirmLabel: "Delete my account",
      tone: "danger",
    });
    if (!ok) return;
    setPending(true);
    setError(null);
    const result = await apiRequest("/api/account", { method: "DELETE", body: { password } });
    if (!result.ok) {
      setPending(false);
      setError(result.fieldErrors.password?.[0] ?? result.message);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <Card className="flex flex-col gap-3 border-danger/40">
      <CardTitle>Delete account</CardTitle>
      <CardDescription>{consequences}</CardDescription>
      {!open ? (
        <Button variant="danger-outline" className="self-start" onClick={() => setOpen(true)}>
          Delete my account…
        </Button>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            remove();
          }}
        >
          <FormError message={error} />
          <Field label="Enter your password to confirm">
            {(p) => <Input {...p} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="danger" disabled={pending || !password}>
              {pending ? "Deleting…" : "Delete my account permanently"}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Keep my account
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
