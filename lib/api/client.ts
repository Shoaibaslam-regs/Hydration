// Browser-side helper for calling our Route Handlers.
import type { ApiErrorBody } from "./errors";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string; fieldErrors: Record<string, string[] | undefined> };

export async function apiRequest<T>(url: string, init: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    return { ok: false, status: 0, message: "Network error. Check your connection and try again.", fieldErrors: {} };
  }
  const body = await res.json().catch(() => null);
  if (res.ok) return { ok: true, data: body as T };

  const error = (body as ApiErrorBody | null)?.error;
  const details = error?.details as { fieldErrors?: Record<string, string[]> } | undefined;
  return {
    ok: false,
    status: res.status,
    message: error?.message ?? "Something went wrong",
    fieldErrors: details?.fieldErrors ?? {},
  };
}
