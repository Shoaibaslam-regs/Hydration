"use client";

import { useState } from "react";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api/client";
import { formatDateTime } from "@/lib/catalog";

/** Creates a one-time password reset link for the admin to send to the user. */
export function ResetLinkButton({ userId }: { userId: string }) {
  const [pending, setPending] = useState(false);
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setPending(true);
    setError(null);
    setCopied(false);
    const result = await apiRequest<{ url: string; expiresAt: string }>(`/api/admin/users/${userId}/reset-link`, { body: {} });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setLink(result.data);
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
    } catch {
      setError("Couldn't copy automatically. Select the link and copy it.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <FormError message={error} />
      {link ? (
        <>
          <div className="flex gap-2">
            <Input readOnly value={link.url} aria-label="Password reset link" onFocus={(e) => e.currentTarget.select()} />
            <Button variant="secondary" onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Send this to the user privately. It works once and expires {formatDateTime(link.expiresAt)}. Creating a new
            link cancels this one.
          </p>
        </>
      ) : (
        <Button variant="secondary" onClick={create} disabled={pending} className="self-start">
          {pending ? "Creating…" : "Create password reset link"}
        </Button>
      )}
    </div>
  );
}
