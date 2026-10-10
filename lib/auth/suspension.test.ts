import { describe, expect, it } from "vitest";
import { isSuspended } from "./suspension";

const now = new Date("2026-10-10T12:00:00Z");

describe("isSuspended", () => {
  it("covers active, indefinite, running and expired suspensions", () => {
    expect(isSuspended({ status: "active" }, now)).toBe(false);
    expect(isSuspended({ status: "suspended", suspendedUntil: null }, now)).toBe(true);
    expect(isSuspended({ status: "suspended", suspendedUntil: new Date("2026-10-11T00:00:00Z") }, now)).toBe(true);
    expect(isSuspended({ status: "suspended", suspendedUntil: new Date("2026-10-10T11:59:59Z") }, now)).toBe(false);
  });
});
