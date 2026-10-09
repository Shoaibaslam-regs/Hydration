import { describe, expect, it } from "vitest";
import { MAX_PAGE_SIZE, paginated, paginationSchema, skipFor } from "./pagination";

describe("paginationSchema", () => {
  it("applies defaults", () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, limit: 20 });
  });

  it("coerces query-string values", () => {
    expect(paginationSchema.parse({ page: "2", limit: "50" })).toEqual({ page: 2, limit: 50 });
  });

  it("rejects out-of-range values", () => {
    expect(paginationSchema.safeParse({ page: "0" }).success).toBe(false);
    expect(paginationSchema.safeParse({ limit: String(MAX_PAGE_SIZE + 1) }).success).toBe(false);
  });
});

describe("helpers", () => {
  it("computes skip", () => {
    expect(skipFor({ page: 3, limit: 10 })).toBe(20);
  });

  it("builds page metadata", () => {
    expect(paginated(["a"], 21, { page: 1, limit: 10 })).toMatchObject({ total: 21, totalPages: 3 });
    expect(paginated([], 0, { page: 1, limit: 10 }).totalPages).toBe(1);
  });
});
