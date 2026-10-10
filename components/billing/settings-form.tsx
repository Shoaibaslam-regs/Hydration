"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Field, Textarea } from "@/components/ui/input";
import { apiRequest } from "@/lib/api/client";

export function SettingsForm({
  requireSubscription,
  paymentInstructions,
  shopsWithoutPlan,
}: {
  requireSubscription: boolean;
  paymentInstructions: string;
  shopsWithoutPlan: number;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [instructions, setInstructions] = useState(paymentInstructions);
  const [pending, setPending] = useState<"toggle" | "save" | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>, which: "toggle" | "save") {
    setPending(which);
    setError(null);
    setSaved(false);
    const result = await apiRequest("/api/admin/settings", { method: "PATCH", body });
    setPending(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (which === "save") setSaved(true);
    router.refresh();
  }

  async function toggle() {
    const turningOn = !requireSubscription;
    const msg = turningOn
      ? `${shopsWithoutPlan} approved ${shopsWithoutPlan === 1 ? "shop" : "shops"} without one will disappear from search and stop taking new orders right away.`
      : "Every approved, open shop will be listed again.";
    const ok = await confirm({
      title: turningOn ? "Require an active plan?" : "Stop requiring a plan?",
      message: msg,
      confirmLabel: turningOn ? "Turn on" : "Turn off",
      tone: turningOn ? "danger" : "primary",
    });
    if (ok) patch({ requireSubscription: turningOn }, "toggle");
  }

  return (
    <div className="flex flex-col gap-5">
      <FormError message={error} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl">
          <p className="font-medium">Require an active plan to be listed</p>
          <p className="text-sm text-muted-foreground">
            {requireSubscription
              ? "On: shops without an active plan are hidden from search and can't take new orders."
              : `Off: every approved shop is listed. Turning it on would hide ${shopsWithoutPlan} ${shopsWithoutPlan === 1 ? "shop" : "shops"} that ${shopsWithoutPlan === 1 ? "has" : "have"} no active plan.`}
          </p>
        </div>
        <Button variant={requireSubscription ? "danger-outline" : "primary"} onClick={toggle} disabled={pending !== null}>
          {pending === "toggle" ? "Saving…" : requireSubscription ? "Turn off" : "Turn on"}
        </Button>
      </div>
      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <Field label="Payment instructions for shopkeepers" hint="Shown on every shop's billing page: account titles and numbers for bank transfer, JazzCash, Easypaisa.">
          {(p) => <Textarea {...p} value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={2000} rows={5} />}
        </Field>
        <div className="flex items-center gap-3">
          <Button onClick={() => patch({ paymentInstructions: instructions }, "save")} disabled={pending !== null || instructions === paymentInstructions}>
            {pending === "save" ? "Saving…" : "Save instructions"}
          </Button>
          {saved && (
            <span role="status" className="text-sm text-success">
              Saved.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
