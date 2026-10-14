"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import { apiRequest } from "@/lib/api/client";

/** Admin: the prices and payment details shopkeepers see on their Promote page. */
export function SponsorshipInfoForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setError(null);
    setSaved(false);
    const result = await apiRequest("/api/admin/settings", { method: "PATCH", body: { sponsorshipInfo: text } });
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
      <Field label="How to pay for the Sponsored plan" hint="Shown on the Sponsored plan card on every shop's Promote page, e.g. “JazzCash 0300 1234567 (Aqua Pvt Ltd). Put your shop name in the reference.” The price is fixed in the app.">
        {(p) => <Textarea {...p} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={4} />}
      </Field>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending || text === initial}>
          {pending ? "Saving…" : "Save"}
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
