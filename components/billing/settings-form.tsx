"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import { apiRequest } from "@/lib/api/client";

/** Admin: where shopkeepers send plan payments, shown on every shop's billing page. */
export function SettingsForm({ paymentInstructions }: { paymentInstructions: string }) {
  const router = useRouter();
  const [instructions, setInstructions] = useState(paymentInstructions);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setError(null);
    setSaved(false);
    const result = await apiRequest("/api/admin/settings", { method: "PATCH", body: { paymentInstructions: instructions } });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <FormError message={error} />
      <Field label="Payment instructions for shopkeepers" hint="Shown on every shop's billing page: account titles and numbers for bank transfer, JazzCash, Easypaisa.">
        {(p) => <Textarea {...p} value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={2000} rows={5} />}
      </Field>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending || instructions === paymentInstructions}>
          {pending ? "Saving…" : "Save instructions"}
        </Button>
        {saved && (
          <span role="status" className="text-sm text-success">
            Saved.
          </span>
        )}
      </div>
    </div>
  );
}
