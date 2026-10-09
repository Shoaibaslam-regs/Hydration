import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, type ApiErrorBody } from "./errors";

/**
 * Wraps a Route Handler so thrown ApiErrors and ZodErrors become consistent
 * JSON error responses, and unexpected errors never leak internals.
 */
export function apiHandler<Ctx>(fn: (req: NextRequest, ctx: Ctx) => Promise<Response>) {
  return async (req: NextRequest, ctx: Ctx): Promise<Response> => {
    try {
      assertSameOrigin(req);
      return await fn(req, ctx);
    } catch (err) {
      // Let Next.js control-flow errors (prerender bailouts, redirect, notFound) propagate.
      unstable_rethrow(err);
      return errorResponse(err);
    }
  };
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defense for cookie-authenticated mutations: browsers always send
 * Origin on cross-site POST/PUT/PATCH/DELETE, so reject when it doesn't match.
 */
function assertSameOrigin(req: Request) {
  if (SAFE_METHODS.has(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return; // Non-browser clients (curl, server-to-server) don't send Origin.
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw ApiError.forbidden("Invalid origin");
  }
  if (originHost !== host) throw ApiError.forbidden("Cross-site request blocked");
}

export function errorResponse(err: unknown): Response {
  if (err instanceof ApiError) {
    const retryAfter = (err.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds;
    return json<ApiErrorBody>(
      { error: { code: err.code, message: err.message, details: err.details } },
      err.status,
      retryAfter ? { headers: { "Retry-After": String(retryAfter) } } : undefined,
    );
  }
  if (err instanceof z.ZodError) {
    return json<ApiErrorBody>(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid input",
          details: fieldErrorsByPath(err),
        },
      },
      400,
    );
  }
  console.error(err);
  return json<ApiErrorBody>(
    { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
    500,
  );
}

/** Like z.flattenError, but nested fields are keyed by full path ("address.city"). */
function fieldErrorsByPath(err: z.ZodError) {
  const formErrors: string[] = [];
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of err.issues) {
    if (issue.path.length === 0) formErrors.push(issue.message);
    else (fieldErrors[issue.path.join(".")] ??= []).push(issue.message);
  }
  return { formErrors, fieldErrors };
}

export function json<T>(body: T, status = 200, init?: ResponseInit): Response {
  return Response.json(body, { ...init, status });
}

/** Largest JSON body any endpoint accepts. Our biggest payload (an order) is a few KB. */
export const MAX_BODY_BYTES = 64 * 1024;

/** Read the body as text, stopping as soon as it exceeds `limit` bytes. */
async function readBodyText(req: Request, limit: number): Promise<string> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) throw ApiError.payloadTooLarge(limit);
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw ApiError.payloadTooLarge(limit);
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** Parse and validate a JSON request body (max MAX_BODY_BYTES). Throws ZodError / ApiError. */
export async function parseBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  const text = await readBodyText(req, MAX_BODY_BYTES);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw ApiError.badRequest("Request body must be valid JSON");
  }
  return schema.parse(raw);
}

/** Parse and validate URL query parameters. Throws ZodError. */
export function parseQuery<S extends z.ZodType>(req: NextRequest, schema: S): z.infer<S> {
  return schema.parse(Object.fromEntries(req.nextUrl.searchParams));
}
