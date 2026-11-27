// Spec: k.realm, clause "A project whose `node_modules` resolves `@keel/schema` to two folders (the app's and one nested under a dependency) is one E1765 at `package.json` from `keel check` and from `keel build`; with one folder it is none."
// Seed 1337 (no generated input: one fixture project, with and without the nested copy). The real binary over a temp project with `@keel/*` linked.
// The `check` half of the in-memory fixture is packages/check/conformance/two-copies.test.ts.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { SLOW, type Tree, cleanup, keelRun, materialize, nodeTree, recordsOf, write } from "./boundary-support.ts";

const pkg = (name: string, extra: Record<string, unknown> = {}) =>
  `${JSON.stringify({ name, version: "1.0.0", type: "module", ...extra })}\n`;
const withDep = (tree: Tree): Tree => ({
  ...tree,
  "package.json": pkg("fx", { private: true, dependencies: { "@keel/schema": "1.0.0", dep: "1.0.0" } }),
  "node_modules/dep/package.json": pkg("dep", { dependencies: { "@keel/schema": "1.0.0" } }),
});
const NESTED: Tree = { "node_modules/dep/node_modules/@keel/schema/package.json": pkg("@keel/schema") };

let two = "";
let one = "";
beforeAll(() => {
  two = materialize(withDep(nodeTree("node")));
  write(two, NESTED);
  one = materialize(withDep(nodeTree("node")));
}, SLOW);
afterAll(() => {
  cleanup(two);
  cleanup(one);
});

describe("k.realm One copy: keel check and keel build", () => {
  for (const command of ["check", "build"] as const) {
    test(
      `a project whose node_modules resolves @keel/schema to two folders is one E1765 at package.json from keel ${command}`,
      () => {
        const r = keelRun(two, [command]);
        const lines = recordsOf(r.out, "E1765");
        expect(lines, r.out).toHaveLength(1);
        expect(lines[0]).toContain("package.json");
        expect(lines[0]).toContain("two copies of @keel/schema in one realm: ");
        expect(lines[0]).toContain("node_modules/dep/node_modules/@keel/schema");
        expect(r.status).toBe(1);
      },
      SLOW,
    );

    test(
      `with one folder for @keel/schema keel ${command} reports no E1765`,
      () => {
        const r = keelRun(one, [command]);
        expect(recordsOf(r.out, "E1765"), r.out).toEqual([]);
      },
      SLOW,
    );
  }
});
