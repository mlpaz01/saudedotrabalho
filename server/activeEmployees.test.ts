import { describe, expect, it } from "vitest";
import { defaultCountsAsEmployee, isActiveEmployee } from "./_core/activeEmployees";

describe("active employee business rule", () => {
  it.each(["user", "chefia", "cipa", "sesmt", "admin", "company_admin"])(
    "includes active employee role %s",
    (role) => {
      expect(isActiveEmployee({ is_active: 1, employment_status: "active", role })).toBe(true);
    },
  );

  it.each(["admin_global", "super_admin", "rh", "psicologo", "intermediador"])(
    "excludes administrative or external role %s by default",
    (role) => {
      expect(defaultCountsAsEmployee(role)).toBe(false);
      expect(isActiveEmployee({ is_active: 1, employment_status: "active", role })).toBe(false);
    },
  );

  it("allows an internal RH employee to be explicitly included", () => {
    expect(isActiveEmployee({
      is_active: 1,
      employment_status: "active",
      role: "rh",
      counts_as_employee: 1,
    })).toBe(true);
  });

  it("allows an external SESMT provider to be explicitly excluded", () => {
    expect(isActiveEmployee({
      is_active: 1,
      employment_status: "active",
      role: "sesmt",
      counts_as_employee: 0,
    })).toBe(false);
  });

  it.each(["away", "terminated", "death", "retired", "other"])(
    "excludes employment status %s",
    (employment_status) => {
      expect(isActiveEmployee({ is_active: 1, employment_status, role: "user" })).toBe(false);
    },
  );

  it("excludes disabled accounts", () => {
    expect(isActiveEmployee({ is_active: 0, employment_status: "active", role: "user" })).toBe(false);
  });
});
