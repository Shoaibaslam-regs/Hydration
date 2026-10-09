import { randomBytes } from "node:crypto";
import { inject, vi } from "vitest";

// Each test file gets its own database (and module registry), so files can run in parallel.
process.env.MONGODB_URI = `${inject("mongoUri").replace(/\/$/, "")}/test_${randomBytes(4).toString("hex")}`;
process.env.JWT_SECRET ??= "test-secret-that-is-at-least-32-characters-long";

// Next's cache APIs only work inside a Next request; services call them after writes.
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
}));
