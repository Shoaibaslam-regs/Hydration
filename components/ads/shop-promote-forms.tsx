"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { CAMPAIGN_WEEKS, MAX_DEAL_DAYS } from "@/lib/ads/constants";
import { apiRequest } from "@/lib/api/client";

type Errors = Record<string, string[] | undefined>;

export function CampaignRequestForm({ today }: { today: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Errors>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const result = await apiRequest("/api/shopkeeper/campaigns", {
      body: { startDate: f.get("startDate"), weeks: Number(f.get("weeks")), note: f.get("note") },
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      setFieldErrors(result.fieldErrors);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <FormError message={error} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Start date" error={fieldErrors.startDate?.[0]}>
          {(p) => <Input {...p} name="startDate" type="date" min={today} defaultValue={today} required />}
        </Field>
        <Field label="Length" error={fieldErrors.weeks?.[0]}>
          {(p) => (
            <Select {...p} name="weeks" defaultValue="1">
              {CAMPAIGN_WEEKS.map((w) => (
                <option key={w} value={w}>
                  {w} {w === 1 ? "week" : "weeks"}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label="Note (optional)" hint="e.g. the transaction ID of your payment." error={fieldErrors.note?.[0]}>
        {(p) => <Input {...p} name="note" maxLength={300} />}
      </Field>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Sending…" : "Request sponsorship"}
      </Button>
    </form>
  );
}

const DEAL_DAYS = [1, 3, 7, 14, MAX_DEAL_DAYS];

export function DealForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Errors>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setPending(true);
    setError(null);
    const result = await apiRequest("/api/shopkeeper/deals", {
      body: { title: f.get("title"), description: f.get("description"), days: Number(f.get("days")) },
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      setFieldErrors(result.fieldErrors);
      return;
    }
    form.reset();
    setFieldErrors({});
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <FormError message={error} />
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <Field label="Deal" hint="Short and specific, e.g. “19L can PKR 220 this week”." error={fieldErrors.title?.[0]}>
          {(p) => <Input {...p} name="title" maxLength={80} required />}
        </Field>
        <Field label="Runs for" error={fieldErrors.days?.[0]}>
          {(p) => (
            <Select {...p} name="days" defaultValue="7">
              {DEAL_DAYS.map((d) => (
                <option key={d} value={d}>
                  {d} {d === 1 ? "day" : "days"}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label="Details (optional)" error={fieldErrors.description?.[0]}>
        {(p) => <Textarea {...p} name="description" maxLength={300} rows={2} />}
      </Field>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Posting…" : "Post deal"}
      </Button>
    </form>
  );
}
