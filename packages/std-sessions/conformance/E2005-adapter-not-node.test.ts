// Spec: std.sessions, clause "E2001-E2005 each fire on a fixture, not on its clean twin." (E2005)
// Seed 1337
import { fixedTime } from "@keel/tooling/test-time";
import { check } from "@keel/check";
import { describe, expect, test } from "vitest";
import "@keel/std-sessions/tools";
import { cartModuleFiles, diagCodes, topologySource } from "./fixtures.ts";

const routesFile = (imports: string) => ({
  path: "modules/cart/routes.ts",
  source: `import { manifest } from '@keel/router'\nimport { cart } from './cart.contract.ts'\n${imports}\nexport const routes = manifest(cart, {})\n`,
});
const SESSIONS = "import { routes as sessions } from '@keel/std-sessions/routes'";
const RECORD = "import { record } from '@keel/std-sessions/record'";

// E2005 `sessions` in a deployable whose adapter is not `node` (check rule)
describe("std.sessions: E2005 fires on a fixture, not on its clean twin.", () => {
  const codes = (adapter: "node" | "static" | "client", imports = SESSIONS) =>
    diagCodes(check([...cartModuleFiles([]), routesFile(imports), topologySource(adapter)], { types: false }));

  test(
    "E2005 fires on a fixture, not on its clean twin: E2005 for a static deployable",
    () => {
      expect(codes("static")).toContain("E2005");
    },
    fixedTime(30_000),
  );
  test(
    "E2005 fires on a fixture, not on its clean twin: E2005 for a client deployable",
    () => {
      expect(codes("client")).toContain("E2005");
    },
    fixedTime(30_000),
  );
  test(
    "E2005 fires on a fixture, not on its clean twin: E2005 absent for a node deployable",
    () => {
      expect(codes("node")).not.toContain("E2005");
    },
    fixedTime(30_000),
  );
  const viaFile = (adapter: "node" | "client", file: string, imports: string, reexport: string) =>
    diagCodes(
      check(
        [
          ...cartModuleFiles([]),
          routesFile(reexport),
          { path: file, source: `${imports}\nexport const marker = 1\n` },
          topologySource(adapter),
        ],
        { types: false },
      ),
    );

  test(
    "E2005 fires on a fixture, not on its clean twin: E2005 for a dynamic import of the routes",
    () => {
      const dynamic = "export const load = () => import('@keel/std-sessions/routes')";
      expect(codes("client", dynamic)).toContain("E2005");
      expect(codes("node", dynamic)).not.toContain("E2005");
      expect(codes("client", "export const load = () => import('@keel/std-sessions/record')")).not.toContain("E2005");
    },
    fixedTime(30_000),
  );
  test(
    "E2005 fires on a fixture, not on its clean twin: E2005 through a .js specifier that names a .ts file",
    () => {
      const hop = "export * from './sess.js'";
      const target = "export { routes } from '@keel/std-sessions/routes'";
      expect(viaFile("client", "modules/cart/sess.ts", target, hop)).toContain("E2005");
      expect(viaFile("node", "modules/cart/sess.ts", target, hop)).not.toContain("E2005");
      expect(viaFile("client", "modules/cart/sess.ts", "export const x = 1", hop)).not.toContain("E2005");
    },
    fixedTime(30_000),
  );
  test(
    "E2005 fires on a fixture, not on its clean twin: E2005 through a re-export in a .tsx file",
    () => {
      const hop = "export * from './sess.tsx'";
      const target = "export { routes } from '@keel/std-sessions/routes'";
      expect(viaFile("client", "modules/cart/sess.tsx", target, hop)).toContain("E2005");
      expect(viaFile("node", "modules/cart/sess.tsx", target, hop)).not.toContain("E2005");
      expect(viaFile("client", "modules/cart/sess.tsx", "export const x = 1", hop)).not.toContain("E2005");
    },
    fixedTime(30_000),
  );
  test(
    "E2005 fires on a fixture, not on its clean twin: E2005 for a substitution-free template import",
    () => {
      expect(codes("client", "export const load = () => import(`@keel/std-sessions/routes`)")).toContain("E2005");
      expect(codes("node", "export const load = () => import(`@keel/std-sessions/routes`)")).not.toContain("E2005");
    },
    fixedTime(30_000),
  );
  test(
    "E2005 fires on a fixture, not on its clean twin: E2005 absent for a type-only import of the routes",
    () => {
      expect(codes("client", "import { routes as sessions } from '@keel/std-sessions/routes'")).toContain("E2005");
      expect(codes("client", "import type { routes as sessions } from '@keel/std-sessions/routes'")).not.toContain(
        "E2005",
      );
      expect(codes("client", "export type { routes } from '@keel/std-sessions/routes'")).not.toContain("E2005");
    },
    fixedTime(30_000),
  );
  test(
    "E2005 fires on a fixture, not on its clean twin: E2005 absent for a client record-only import",
    () => {
      expect(codes("client", RECORD)).not.toContain("E2005");
    },
    fixedTime(30_000),
  );
});
