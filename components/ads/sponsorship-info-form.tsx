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
      <Field label="Sponsorship prices and how to pay" hint="Shown on every shop's Promote page, e.g. “1 week PKR 1,500 · 2 weeks PKR 2,500 · 4 weeks PKR 4,000. Pay to …”">
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
