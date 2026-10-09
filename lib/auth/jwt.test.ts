import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signSession, verifySession } from "./jwt";

const SECRET = "test-secret-that-is-definitely-long-enough-123";

describe("session JWT", () => {
  beforeEach(() => vi.stubEnv("JWT_SECRET", SECRET));
  afterEach(() => vi.unstubAllEnvs());

  it("round-trips claims", async () => {
    const token = await signSession({ sub: "u1", role: "shopkeeper", ver: 2 });
    expect(await verifySession(token)).toEqual({ sub: "u1", role: "shopkeeper", ver: 2 });
  });

  it("rejects missing, malformed and tampered tokens", async () => {
    const token = await signSession({ sub: "u1", role: "customer", ver: 0 });
    const [h, , s] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ sub: "u1", role: "admin", ver: 0 })).toString("base64url");
    expect(await verifySession(undefined)).toBeNull();
    expect(await verifySession("not-a-jwt")).toBeNull();
    expect(await verifySession(`${h}.${forgedPayload}.${s}`)).toBeNull();
  });

  it("rejects tokens signed with another secret", async () => {
    const token = await signSession({ sub: "u1", role: "customer", ver: 0 });
    vi.stubEnv("JWT_SECRET", "a-completely-different-secret-value-456789");
    expect(await verifySession(token)).toBeNull();
  });

  it("rejects expired tokens and unknown roles", async () => {
    const key = new TextEncoder().encode(SECRET);
    const expired = await new SignJWT({ role: "customer", ver: 0 })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("u1")
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(key);
    const badRole = await new SignJWT({ role: "superuser", ver: 0 })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("u1")
      .setExpirationTime("1h")
      .sign(key);
    expect(await verifySession(expired)).toBeNull();
    expect(await verifySession(badRole)).toBeNull();
  });
});
