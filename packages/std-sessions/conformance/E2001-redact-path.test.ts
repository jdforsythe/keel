// Spec: std.sessions, clause "Each of E2001-E2005 has a fixture that triggers it and a clean counterpart."
// Seed 1337
import { check } from "@keel/check";
import { describe, expect, test } from "vitest";
import "@keel/std-sessions";
import { cartModuleFiles, diagCodes } from "./fixtures.ts";

// E2001 `redact` path with an unknown subject, a subject of another module, or a field absent from its schema (check rule registry; fix removes it)
// TODO 0092: unskip
describe.skip("std.sessions: E2001 has a fixture that triggers it and a clean counterpart", () => {
  const codes = (redact: readonly string[]) => diagCodes(check(cartModuleFiles(redact), { types: false }));

  test("Each of E2001-E2005 has a fixture that triggers it: E2001 on an unknown subject", () => {
    expect(codes(["bogus:cart.pay#card.number"])).toContain("E2001");
  });
  test("Each of E2001-E2005 has a fixture that triggers it: E2001 on a subject of another module", () => {
    expect(codes(["tx:orders.pay#card.number"])).toContain("E2001");
  });
  test("Each of E2001-E2005 has a fixture that triggers it: E2001 on a field absent from its schema", () => {
    expect(codes(["tx:cart.pay#card.nope"])).toContain("E2001");
  });
  test("Each of E2001-E2005 has a clean counterpart: E2001 absent for a valid redact path", () => {
    expect(codes(["tx:cart.pay#card.number"])).not.toContain("E2001");
  });
});
