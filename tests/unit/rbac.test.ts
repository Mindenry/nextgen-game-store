import { describe, expect, it } from "vitest";
import { can, requirePermission, AuthorizationError, isStaff, type SessionUser } from "@/lib/auth/rbac";

const customer: SessionUser = {
  id: "u1",
  email: "c@example.com",
  displayName: "Customer",
  username: null,
  avatarUrl: null,
  roleId: "customer",
  roleName: "Customer",
  status: "active",
  emailVerified: true,
  permissions: [],
};

const support: SessionUser = {
  ...customer,
  roleId: "support",
  roleName: "Support",
  permissions: ["dashboard.view", "orders.view", "support.reply"],
};

describe("RBAC", () => {
  it("denies customers admin permissions", () => {
    expect(can(customer, "orders.view")).toBe(false);
    expect(isStaff(customer)).toBe(false);
    expect(() => requirePermission(customer, "orders.view")).toThrow(AuthorizationError);
  });

  it("allows only granted permissions", () => {
    expect(can(support, "orders.view")).toBe(true);
    expect(can(support, "orders.refund")).toBe(false);
    expect(isStaff(support)).toBe(true);
    expect(() => requirePermission(support, "support.reply")).not.toThrow();
  });

  it("handles null users safely", () => {
    expect(can(null, "dashboard.view")).toBe(false);
    expect(() => requirePermission(null, "dashboard.view")).toThrow(AuthorizationError);
  });
});
