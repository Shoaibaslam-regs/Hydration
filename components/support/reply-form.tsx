"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { apiRequest } from "@/lib/api/client";
import { MAX_SUPPORT_MESSAGE_LENGTH } from "@/lib/support/constants";

/** Reply box under a conversation. Ctrl/⌘ + Enter sends. */
export function SupportReplyForm({ endpoint, placeholder, note }: { endpoint: string; placeholder: string; note?: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!text.trim() || pending) return;
    setPending(true);
    setError(null);
    const result = await apiRequest(endpoint, { body: { body: text } });
    setPending(false);
    if (!result.ok) {
      setError(result.fieldErrors.body?.[0] ?? result.message);
      return;
    }
    setText("");
    router.refresh();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className="flex flex-col gap-2"
    >
      <FormError message={error} />
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            send();
          }
        }}
        rows={3}
        maxLength={MAX_SUPPORT_MESSAGE_LENGTH}
        placeholder={placeholder}
        aria-label="Your reply"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{note}</span>
        <Button type="submit" disabled={pending || !text.trim()}>
          {pending ? "Sending…" : "Send reply"}
        </Button>
      </div>
    </form>
  );
}
