"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { apiRequest } from "@/lib/api/client";
import { formatIban } from "@/lib/billing/iban";

type Values = { bankName: string; accountTitle: string; iban: string; paymentInstructions: string };

/**
 * Admin: the bank account (IBAN) shopkeepers pay their monthly fee into, plus
 * other ways to pay. Shown on every shop's billing page.
 */
export function SettingsForm({ initial }: { initial: Values }) {
  const router = useRouter();
  const start = { ...initial, iban: formatIban(initial.iban) };
  const [values, setValues] = useState(start);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const changed = (Object.keys(values) as (keyof Values)[]).some((k) => values[k] !== start[k]);
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSaved(false);
    setValues((v) => ({ ...v, [k]: e.target.value }));
  };

  async function save() {
    setPending(true);
    setError(null);
    setSaved(false);
    const result = await apiRequest("/api/admin/settings", { method: "PATCH", body: values });
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
    <div className="flex flex-col gap-3">
      <FormError message={error} />
      <p className="text-sm font-medium">Bank account for monthly fees</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Bank" error={fieldErrors.bankName?.[0]}>
          {(p) => <Input {...p} value={values.bankName} onChange={set("bankName")} maxLength={80} placeholder="e.g. Meezan Bank" />}
        </Field>
        <Field label="Account title" error={fieldErrors.accountTitle?.[0]}>
          {(p) => <Input {...p} value={values.accountTitle} onChange={set("accountTitle")} maxLength={120} placeholder="e.g. Aqua Water Services" />}
        </Field>
      </div>
      <Field label="IBAN" hint="Checked before saving. Shopkeepers see it with a copy button." error={fieldErrors.iban?.[0]}>
        {(p) => (
          <Input
            {...p}
            value={values.iban}
            onChange={set("iban")}
            maxLength={42}
            placeholder="PK36 SCBL 0000 0011 2345 6702"
            className="font-mono uppercase tracking-wide"
            autoComplete="off"
            spellCheck={false}
          />
        )}
      </Field>
      <Field
        label="Other ways to pay (optional)"
        hint="Shown under the bank account, e.g. JazzCash or Easypaisa numbers, or “Put your Shop ID in the reference”."
        error={fieldErrors.paymentInstructions?.[0]}
      >
        {(p) => <Textarea {...p} value={values.paymentInstructions} onChange={set("paymentInstructions")} maxLength={2000} rows={3} />}
      </Field>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending || !changed}>
          {pending ? "Saving…" : "Save payment details"}
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
