// Spec: std.sessions, clause "Each of E2001-E2005 has a fixture that triggers it and a clean counterpart."
// Seed 1337
import { check } from "@keel/check";
import { describe, expect, test } from "vitest";
import "@keel/std-sessions";
import { cartModuleFiles, diagCodes, topologySource } from "./fixtures.ts";

// E2005 `sessions` in a deployable whose adapter is not `node` (check rule)
// TODO 0092: unskip
describe.skip("std.sessions: E2005 has a fixture that triggers it and a clean counterpart", () => {
  const codes = (adapter: "node" | "static" | "client") =>
    diagCodes(check([...cartModuleFiles([]), topologySource(adapter)], { types: false }));

  test("Each of E2001-E2005 has a fixture that triggers it: E2005 for a static deployable", () => {
    expect(codes("static")).toContain("E2005");
  });
  test("Each of E2001-E2005 has a fixture that triggers it: E2005 for a client deployable", () => {
    expect(codes("client")).toContain("E2005");
  });
  test("Each of E2001-E2005 has a clean counterpart: E2005 absent for a node deployable", () => {
    expect(codes("node")).not.toContain("E2005");
  });
});
