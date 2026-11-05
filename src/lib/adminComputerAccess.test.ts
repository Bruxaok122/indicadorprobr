import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { adminAccessDenied } from "./adminComputerAccess";

describe("administrative computer access", () => {
  it("rejects blocked computers", () => {
    expect(adminAccessDenied({ allowed: false, reason: "blocked" })).toBe(true);
  });
  it("rejects logged-out sessions instead of reactivating them", () => {
    expect(adminAccessDenied({ allowed: false, reason: "logged_out" })).toBe(true);
  });
  it("allows an authorized active computer", () => {
    expect(adminAccessDenied({ allowed: true, computer_id: "authorized" })).toBe(false);
  });
});