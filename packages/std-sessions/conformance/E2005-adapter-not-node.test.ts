// Spec: std.sessions, clause "E2005 fires on a fixture, not on its clean twin."
// Seed 1337
import { check } from "@keel/check";
import { describe, expect, test } from "vitest";
import "@keel/std-sessions/tools";
import { cartModuleFiles, diagCodes, topologySource } from "./fixtures.ts";

const routesFile = (imports: string) => ({
  path: "modules/cart/routes.ts",
  source: `import { manifest } from '@keel/router'\n${imports}\nexport const routes = manifest({})\n`,
});
const SESSIONS = "import { routes as sessions } from '@keel/std-sessions/routes'";
const RECORD = "import { record } from '@keel/std-sessions/record'";

// E2005 `sessions` in a deployable whose adapter is not `node` (check rule)
describe("std.sessions: E2005 fires on a fixture, not on its clean twin.", () => {
  const codes = (adapter: "node" | "static" | "client", imports = SESSIONS) =>
    diagCodes(check([...cartModuleFiles([]), routesFile(imports), topologySource(adapter)], { types: false }));

  test("E2005 fires on a fixture, not on its clean twin: E2005 for a static deployable", () => {
    expect(codes("static")).toContain("E2005");
  });
  test("E2005 fires on a fixture, not on its clean twin: E2005 for a client deployable", () => {
    expect(codes("client")).toContain("E2005");
  });
  test("E2005 fires on a fixture, not on its clean twin: E2005 absent for a node deployable", () => {
    expect(codes("node")).not.toContain("E2005");
  });
  test("E2005 fires on a fixture, not on its clean twin: E2005 absent for a client record-only import", () => {
    expect(codes("client", RECORD)).not.toContain("E2005");
  });
});
