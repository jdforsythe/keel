// Spec: k.topology, clause "With `topology({ web: { modules: ['shop', 'ghost'], adapter: 'node' } })` and no `modules/ghost/`, `keel check` and `keel build` each report one E1552 at `'ghost'` in `topology.ts`, message `web: unknown module ghost`, and `keel build` writes no `dist/web/server.mjs`; with `modules/ghost/module.ts` present, or `ghost` the root manifest id of a library in `shop`'s `deps`, neither reports it."
// Seed 1337 (no generated input: the three project shapes the clause names). The real binary over temp projects with `@keel/*` linked.
// The `check` half over in-memory files is packages/check/conformance/topology-unknown-module.test.ts.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { SLOW, type Tree, cleanup, keelRun, manifestSrc, materialize, nodeTree } from "./boundary-support.ts";

const MESSAGE = "web: unknown module ghost";
const topo = (tree: Tree, modules: string): Tree => ({
  ...tree,
  "topology.ts": `import { topology } from '@keel/server'\nexport default topology({ web: { modules: [${modules}], adapter: 'node' } })\n`,
});
const BASE = (): Tree => nodeTree("node");
const dirs: string[] = [];
const fixture = (tree: Tree): string => {
  const d = materialize(tree);
  dirs.push(d);
  return d;
};
let missing = "";
let present = "";
let library = "";
beforeAll(() => {
  missing = fixture(topo(BASE(), "'a', 'ghost'"));
  present = fixture({
    ...topo(BASE(), "'a', 'ghost'"),
    "modules/ghost/module.ts": manifestSrc("ghost"),
  });
  library = fixture({
    ...topo(BASE(), "'a', 'ghost'"),
    "modules/a/module.ts": `import { module } from '@keel/compiler'\nexport default module({ id: 'a', deps: ['@acme/ghost'], capabilities: [], public: { exports: [] } })\n`,
    "node_modules/@acme/ghost/package.json": `${JSON.stringify({ name: "@acme/ghost", version: "1.0.0", type: "module", keel: "library" })}\n`,
    "node_modules/@acme/ghost/module.ts": manifestSrc("ghost"),
  });
}, SLOW);
afterAll(() => {
  for (const d of dirs) cleanup(d);
});

const unknown = (out: string): string[] => out.split("\n").filter((l) => l.includes('"E1552"') && l.includes(MESSAGE));

describe("k.topology unknown module: keel check and keel build", () => {
  for (const command of ["check", "build"] as const) {
    test(
      `with 'ghost' listed and no modules/ghost/ keel ${command} reports one E1552 at 'ghost' in topology.ts, message \`${MESSAGE}\``,
      () => {
        const r = keelRun(missing, [command]);
        const lines = unknown(r.out);
        expect(lines, r.out).toHaveLength(1);
        expect(lines[0]).toContain("topology.ts");
        expect(r.status).toBe(1);
      },
      SLOW,
    );
    test(
      `with modules/ghost/module.ts present keel ${command} does not report it`,
      () => {
        expect(unknown(keelRun(present, [command]).out)).toEqual([]);
      },
      SLOW,
    );
  }

  test(
    "`keel build` writes no dist/web/server.mjs for the unknown module",
    () => {
      keelRun(missing, ["build"]);
      expect(existsSync(join(missing, "dist", "web", "server.mjs"))).toBe(false);
    },
    SLOW,
  );

  test(
    "`ghost` the root manifest id of a library in shop's deps is not reported by keel check or keel build",
    () => {
      for (const command of ["check", "build"]) expect(unknown(keelRun(library, [command]).out), command).toEqual([]);
    },
    SLOW,
  );
});
