"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" for destructive actions: red button, and Cancel gets the focus. */
  tone?: "primary" | "danger";
};

type Confirm = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/**
 * `const confirm = useConfirm(); if (!(await confirm({ title: "Delete?" }))) return;`
 * A themed replacement for `window.confirm()`. Never use the browser's own dialogs.
 */
export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return confirm;
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const messageId = useId();

  const confirm = useCallback<Confirm>((options) => {
    const opts = typeof options === "string" ? { title: options } : options;
    return new Promise<boolean>((resolve) => setPending({ ...opts, resolve }));
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (pending && dialog && !dialog.open) dialog.showModal();
  }, [pending]);

  function close(ok: boolean) {
    dialogRef.current?.close();
    pending?.resolve(ok);
    setPending(null);
  }

  const danger = pending?.tone === "danger";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={pending?.message ? messageId : undefined}
        // Esc closes the dialog: treat it as Cancel.
        onCancel={(e) => {
          e.preventDefault();
          close(false);
        }}
        // A click on the backdrop lands on the <dialog> itself.
        onClick={(e) => {
          if (e.target === e.currentTarget) close(false);
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-[2px]"
      >
        {pending && (
          <div className="flex flex-col gap-5 p-6">
            <div className="flex flex-col gap-2">
              <h2 id={titleId} className="text-lg font-semibold">
                {pending.title}
              </h2>
              {pending.message && (
                <p id={messageId} className="text-sm text-muted-foreground">
                  {pending.message}
                </p>
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => close(false)} autoFocus={danger}>
                {pending.cancelLabel ?? "Cancel"}
              </Button>
              <Button variant={danger ? "danger" : "primary"} onClick={() => close(true)} autoFocus={!danger}>
                {pending.confirmLabel ?? "Confirm"}
              </Button>
            </div>
          </div>
        )}
      </dialog>
    </ConfirmContext.Provider>
  );
}
