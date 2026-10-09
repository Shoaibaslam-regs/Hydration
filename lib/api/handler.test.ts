import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError } from "./errors";
import { apiHandler, parseBody, parseQuery } from "./handler";

describe("apiHandler", () => {
  const req = new NextRequest("http://localhost/api/test");

  it("passes successful responses through", async () => {
    const res = await apiHandler(async () => Response.json({ ok: true }))(req, {});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("maps ApiError to its status and code", async () => {
    const res = await apiHandler(async () => {
      throw ApiError.forbidden();
    })(req, {});
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN");
  });

  it("maps ZodError to 400 VALIDATION_ERROR with field errors", async () => {
    const res = await apiHandler(async () => {
      z.object({ name: z.string() }).parse({});
      return new Response();
    })(req, {});
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.fieldErrors.name).toBeDefined();
  });

  it("hides unexpected errors behind a generic 500", async () => {
    const original = console.error;
    console.error = () => {};
    const res = await apiHandler(async () => {
      throw new Error("db password leaked?");
    })(req, {});
    console.error = original;
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error.message).toBe("Something went wrong");
  });
});

describe("apiHandler same-origin check", () => {
  const ok = apiHandler(async () => Response.json({ ok: true }));
  const post = (headers: Record<string, string>) =>
    new NextRequest("http://localhost:3000/api/x", { method: "POST", headers: { host: "localhost:3000", ...headers } });

  it("blocks cross-site mutations", async () => {
    expect((await ok(post({ origin: "https://evil.example" }), {})).status).toBe(403);
  });

  it("allows same-origin and Origin-less requests", async () => {
    expect((await ok(post({ origin: "http://localhost:3000" }), {})).status).toBe(200);
    expect((await ok(post({}), {})).status).toBe(200);
  });

  it("does not check safe methods", async () => {
    const get = new NextRequest("http://localhost:3000/api/x", { headers: { origin: "https://evil.example" } });
    expect((await ok(get, {})).status).toBe(200);
  });
});

describe("parseBody", () => {
  it("rejects invalid JSON with BAD_REQUEST", async () => {
    const req = new Request("http://localhost", { method: "POST", body: "{nope" });
    await expect(parseBody(req, z.object({}))).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("returns parsed data", async () => {
    const req = new Request("http://localhost", { method: "POST", body: JSON.stringify({ qty: 2 }) });
    expect(await parseBody(req, z.object({ qty: z.number() }))).toEqual({ qty: 2 });
  });
});

describe("parseQuery", () => {
  it("coerces search params through the schema", () => {
    const req = new NextRequest("http://localhost/api?page=3");
    expect(parseQuery(req, z.object({ page: z.coerce.number() }))).toEqual({ page: 3 });
  });
});
