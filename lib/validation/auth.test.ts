import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "./auth";

const valid = { name: "Sara Khan", email: "  Sara@Example.COM ", password: "longenough" };

describe("registerSchema", () => {
  it("normalizes email and defaults role to customer", () => {
    expect(registerSchema.parse(valid)).toMatchObject({ email: "sara@example.com", role: "customer" });
  });

  it("treats a blank phone as absent", () => {
    expect(registerSchema.parse({ ...valid, phone: "" }).phone).toBeUndefined();
    expect(registerSchema.safeParse({ ...valid, phone: "abc" }).success).toBe(false);
  });

  it("never allows self-registering as admin", () => {
    expect(registerSchema.safeParse({ ...valid, role: "admin" }).success).toBe(false);
    expect(registerSchema.parse({ ...valid, role: "shopkeeper" }).role).toBe("shopkeeper");
  });

  it("enforces password length, including bcrypt's 72-byte limit", () => {
    expect(registerSchema.safeParse({ ...valid, password: "short" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, password: "é".repeat(37) }).success).toBe(false); // 74 bytes
  });

  it("rejects invalid emails", () => {
    expect(registerSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("requires both fields", () => {
    expect(loginSchema.safeParse({ email: "a@b.co" }).success).toBe(false);
    expect(loginSchema.parse({ email: "A@B.co", password: "x" }).email).toBe("a@b.co");
  });
});
