// Spec: k.boundary, clause "In a `client` module `process.env.X` in `load.server.ts` is E1759; in a `node` module's `a.guard.ts` it is not; `guard(...)` in `modules/a/auth.ts` is E1009."
// k.boundary, Rules "E1007 server code in a browser build (names the chain) · E1008 a stub of a server-only export called · E1009 `guard` from `@keel/router` used (k.bundle) outside a `*.guard.*` or `*.server.*` file (fix: none)."
// Seed 1337 (the properties below). `check` over in-memory project trees (the type pass is off: the rules read syntax and the topology).
// E1759 reads which files are browser files from `topology.ts`: a `client` module's `*.server.*` and `*.guard.*` files are, a `node` module's are not.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { type Adapter, diagsOf, file, manifestOf, topologyOf } from "./boundary-support.ts";
import { SEED } from "./support.ts";

const shop = (adapter: Adapter, extra: ReturnType<typeof file>[]) => [
  topologyOf({ web: { modules: ["shop"], adapter } }),
  manifestOf("shop"),
  ...extra,
];
const READS = ["process.env.X", "Buffer.from(s)", "global.x", "setImmediate(f)", "import.meta.dirname"];
const IMPORTS = ["import fs from 'node:fs'", "import { join } from 'path'", "export { readFile } from 'fs'"];
const asSource = (stmt: string): string =>
  /^(import|export) /.test(stmt) ? `${stmt}\n` : `export const v = ${stmt}\n`;
const e1759 = (adapter: Adapter, path: string, stmt: string): number =>
  diagsOf(shop(adapter, [file(path, asSource(stmt))]), "E1759").length;

describe("k.boundary: a `client` module's handler files are browser files, so E1759 reads them", () => {
  test("`process.env.X` in `modules/shop/load.server.ts` is one E1759 when a `client` deployable lists `shop`", () => {
    const d = diagsOf(
      shop("client", [file("modules/shop/load.server.ts", "export const v = process.env.X\n")]),
      "E1759",
    );
    expect(d).toHaveLength(1);
    expect(d[0]?.path).toBe("modules/shop/load.server.ts");
  });

  test("`import fs from 'node:fs'` in `modules/shop/load.server.ts` is one E1759 when a `client` deployable lists `shop`", () => {
    expect(e1759("client", "modules/shop/load.server.ts", "import fs from 'node:fs'\nexport const v = fs")).toBe(1);
  });

  test("each read of a Node-only global and each Node built-in import is one E1759 in a `*.server.ts` and in a `*.guard.ts` file of a `client` module", () => {
    for (const path of ["modules/shop/load.server.ts", "modules/shop/pick.guard.ts", "modules/shop/Stock.server.tsx"]) {
      for (const stmt of [...READS, ...IMPORTS]) expect(e1759("client", path, stmt), `${path}: ${stmt}`).toBe(1);
    }
  });

  test("the same holds for a `client` deployable listing `shop` beside a `node` deployable listing another module", () => {
    const files = [
      topologyOf({ api: { modules: ["other"], adapter: "node" }, web: { modules: ["shop"], adapter: "client" } }),
      manifestOf("shop"),
      manifestOf("other"),
      file("modules/shop/load.server.ts", "export const v = process.env.X\n"),
      file("modules/other/load.server.ts", "export const v = process.env.X\n"),
    ];
    expect(diagsOf(files, "E1759").map((d) => d.path)).toEqual(["modules/shop/load.server.ts"]);
  });

  test("property: a Node-only read in a `*.server.*` or `*.guard.*` file is E1759 exactly when only `client` deployables list the module", () => {
    const stmts = fc.constantFrom(...READS, ...IMPORTS);
    const paths = fc.constantFrom(
      "modules/shop/a.server.ts",
      "modules/shop/b.guard.ts",
      "modules/shop/deep/c.server.tsx",
    );
    fc.assert(
      fc.property(stmts, paths, (stmt, path) => {
        expect(e1759("client", path, stmt)).toBe(1);
        expect(e1759("node", path, stmt)).toBe(0);
      }),
      { seed: SEED, numRuns: 40 },
    );
  });
});

describe("k.boundary: a `node` module's server-only files are not browser files", () => {
  test("`process.env.X` in `modules/shop/a.guard.ts` is not E1759 when a `node` deployable lists `shop`", () => {
    expect(e1759("node", "modules/shop/a.guard.ts", "process.env.X")).toBe(0);
  });

  test("every Node-only read and built-in import in a `*.guard.ts` and a `*.server.ts` file of a `node` module is none", () => {
    for (const path of ["modules/shop/a.guard.ts", "modules/shop/load.server.ts"]) {
      for (const stmt of [...READS, ...IMPORTS]) expect(e1759("node", path, stmt), `${path}: ${stmt}`).toBe(0);
    }
  });

  test("a `*.guard.ts` file of a `node` module is still E1759 for `require`, `__dirname` and `__filename`: an ES module has none", () => {
    for (const stmt of ["require('x')", "__dirname", "__filename"]) {
      expect(e1759("node", "modules/shop/a.guard.ts", stmt)).toBe(1);
    }
  });

  test("with no `topology.ts` a `*.guard.ts` file is server-only: its Node-only reads are not E1759", () => {
    for (const stmt of READS) {
      expect(diagsOf([file("src/a.guard.ts", asSource(stmt))], "E1759")).toEqual([]);
    }
  });
});

describe("k.boundary Rules: E1009 `guard` from `@keel/router` used (k.bundle) outside a `*.guard.*` or `*.server.*` file", () => {
  const GUARD =
    "import { guard } from '@keel/router'\nexport const auth = guard({ redirect: 'a.home' }, async () => null)\n";
  const e1009 = (path: string, source = GUARD) => diagsOf([file(path, source)], "E1009");

  test("`export const auth = guard({ redirect: 'a.home' }, fn)` in `modules/a/auth.ts` is one E1009", () => {
    const d = e1009("modules/a/auth.ts");
    expect(d).toHaveLength(1);
    expect(d[0]?.path).toBe("modules/a/auth.ts");
  });

  test("E1009 carries no fix", () => {
    expect(e1009("modules/a/auth.ts")[0]?.fix).toBeUndefined();
  });

  test("the same call in `auth.guard.ts` and in `auth.server.ts` is not E1009", () => {
    expect(e1009("modules/a/auth.guard.ts")).toEqual([]);
    expect(e1009("modules/a/auth.server.ts")).toEqual([]);
  });

  test("`guard({}, fn)` of an API route outside a guard file is one E1009", () => {
    expect(
      e1009(
        "modules/a/auth.ts",
        "import { guard } from '@keel/router'\nexport const auth = guard({}, async () => null)\n",
      ),
    ).toHaveLength(1);
  });

  test("property: a `guard` call is E1009 in any app file but a `*.guard.*` or `*.server.*` one", () => {
    const stem = fc.stringMatching(/^[a-z]{3,8}$/);
    const dir = fc.constantFrom("modules/a", "modules/a/deep", "src", "lib");
    fc.assert(
      fc.property(stem, dir, (name, d) => {
        expect(e1009(`${d}/${name}.ts`)).toHaveLength(1);
        expect(e1009(`${d}/${name}.tsx`)).toHaveLength(1);
        expect(e1009(`${d}/${name}.guard.ts`)).toEqual([]);
        expect(e1009(`${d}/${name}.server.ts`)).toEqual([]);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });
});
