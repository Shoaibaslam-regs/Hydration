import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import { RateLimit, User } from "@/lib/db/models";
import { setupTestDb } from "@/test/db";

// Sessions need Next's cookies(); the lock logic is what's under test here.
vi.mock("@/lib/auth/session", async (orig) => ({ ...(await orig<object>()), createSession: vi.fn(async () => {}) }));

const { POST: login } = await import("@/app/api/auth/login/route");
const { POST: register } = await import("@/app/api/auth/register/route");

setupTestDb();

const call = (handler: typeof login, body: unknown, ip = "203.0.113.7") =>
  handler(
    new Request("http://localhost/api/auth/x", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }) as never,
    { params: Promise.resolve({}) } as never,
  );

const EMAIL = "sara@t.test";
const PASSWORD = "correct horse battery";

beforeEach(async () => {
  await User.create({ name: "Sara", email: EMAIL, passwordHash: await hashPassword(PASSWORD), role: "customer" });
});

describe("login lock", () => {
  it("allows 3 wrong passwords per IP, then locks that IP for 15 minutes", async () => {
    const r1 = await call(login, { email: EMAIL, password: "wrong-1" });
    expect(r1.status).toBe(401);
    expect((await r1.json()).error.message).toContain("2 tries left");
    expect((await call(login, { email: EMAIL, password: "wrong-2" })).status).toBe(401);

    const r3 = await call(login, { email: EMAIL, password: "wrong-3" });
    expect(r3.status).toBe(429);
    expect(Number(r3.headers.get("retry-after"))).toBe(15 * 60);

    // Even the right password waits until the lock ends…
    const r4 = await call(login, { email: EMAIL, password: PASSWORD });
    expect(r4.status).toBe(429);
    expect((await r4.json()).error.details.retryAfterSeconds).toBeGreaterThan(14 * 60);
    // …but other IPs aren't affected.
    expect((await call(login, { email: EMAIL, password: PASSWORD }, "198.51.100.9")).status).toBe(200);

    // After the 15 minutes, it works again.
    await RateLimit.updateMany({}, { $set: { resetAt: new Date(Date.now() - 1000) } });
    expect((await call(login, { email: EMAIL, password: PASSWORD })).status).toBe(200);
  });

  it("forgets earlier failures after a successful login", async () => {
    await call(login, { email: EMAIL, password: "wrong-1" });
    await call(login, { email: EMAIL, password: "wrong-2" });
    expect((await call(login, { email: EMAIL, password: PASSWORD })).status).toBe(200);
    const again = await call(login, { email: EMAIL, password: "wrong-3" });
    expect(again.status).toBe(401);
    expect((await again.json()).error.message).toContain("2 tries left");
  });
});

describe("register lock", () => {
  const signup = (email: string, password = "a strong password") => ({ role: "customer", name: "New Person", email, phone: "", password });

  it("counts rejected sign-ups (taken email, invalid details) and locks after 3", async () => {
    const taken = await call(register, signup(EMAIL));
    expect(taken.status).toBe(409);
    expect((await taken.json()).error.message).toContain("2 tries left");

    const invalid = await call(register, signup("not-an-email"));
    expect(invalid.status).toBe(400);
    const body = await invalid.json();
    expect(body.error.details.fieldErrors.email).toBeDefined(); // the form still shows what to fix
    expect(body.error.message).toContain("1 try left");

    expect((await call(register, signup(EMAIL))).status).toBe(429);
    expect((await call(register, signup("fresh@t.test"))).status).toBe(429);
    expect((await call(register, signup("fresh@t.test"), "198.51.100.9")).status).toBe(201);
  });
});
