import { describe, expect, it } from "vitest";
import { postLoginPath, roleForPath, safeNextPath } from "./roles";

describe("safeNextPath", () => {
  it("allows same-site relative paths", () => {
    expect(safeNextPath("/shops/demo?x=1")).toBe("/shops/demo?x=1");
  });

  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "evil", "", null, undefined])("rejects %s", (next) => {
    expect(safeNextPath(next)).toBeNull();
  });
});

describe("roleForPath", () => {
  it("maps dashboard paths to roles", () => {
    expect(roleForPath("/account")).toBe("customer");
    expect(roleForPath("/shop/orders")).toBe("shopkeeper");
    expect(roleForPath("/admin")).toBe("admin");
  });

  it("does not treat lookalike paths as dashboards", () => {
    expect(roleForPath("/shops")).toBeNull();
    expect(roleForPath("/administrator")).toBeNull();
    expect(roleForPath("/")).toBeNull();
  });
});

describe("postLoginPath", () => {
  it("defaults to the role's dashboard", () => {
    expect(postLoginPath("shopkeeper", null)).toBe("/shop");
  });

  it("honors a safe public next path", () => {
    expect(postLoginPath("customer", "/shops/demo-x")).toBe("/shops/demo-x");
  });

  it("ignores next paths for another role's dashboard or other sites", () => {
    expect(postLoginPath("customer", "/admin")).toBe("/account");
    expect(postLoginPath("customer", "//evil.com")).toBe("/account");
  });
});
