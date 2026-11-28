// Spec: k.supervise, clause "In an app whose `libs/sup/package.json` is `{\"name\":\"@fx/sup\",\"version\":\"0.0.0\",\"type\":\"module\",\"keel\":\"library\",\"exports\":{\".\":{\"keel\":\"./src/index.ts\"}}}`, with `libs/sup/module.ts` of id `sup`, `libs/sup/src/index.ts` holding `export { swallow } from './swallow.ts'` and `libs/sup/src/swallow.ts` exporting `function swallow(ctx: Ctx, f: () => number)` whose body is `return supervise(ctx, 'sup.run', f, T)`: `keel check` reports no E1461 in `libs/sup/src/swallow.ts`, both when `modules/app/module.ts` lists `'@fx/sup'` in `deps` with `node_modules/@fx/sup` a link to `libs/sup`, where each diagnostic of a library file is reported once, at `node_modules/@fx/sup/src/swallow.ts`, and when no manifest lists it."
// Seed: 1337 (no generated input). Binary runs: 2, one per project (the real `keel` binary over a temp project with `@keel/*` linked).
// Fixture: `T` is declared in `swallow.ts` by `s.error`. To see "each diagnostic of a library file is reported once" the linked library also holds
// `src/keys.ts`, whose `Symbol.for('keel.x')` is E1766 in a library's file (k.realm): that one diagnostic is read at both paths.
// Reading: "reported once, at `node_modules/@fx/sup/src/swallow.ts`" names the path a library file's diagnostics carry when the project holds the library there.
import { mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { base } from "./boundary-support.ts";
import { LEDGER, SLOW, type Tree, cleanup, diags, keel, manifestOf, materialize } from "./library-support.ts";

const SUP_PKG =
  '{"name":"@fx/sup","version":"0.0.0","type":"module","keel":"library","exports":{".":{"keel":"./src/index.ts"}}}';
const SWALLOW =
  "import { supervise } from '@keel/ctx'\nimport type { Ctx } from '@keel/ctx'\nimport { s } from '@keel/schema'\nconst T = s.error('sup.thrown', s.object({})).make({})\nexport function swallow(ctx: Ctx, f: () => number) {\n  return supervise(ctx, 'sup.run', f, T)\n}\n";
const tree = (deps: string[], keys: boolean): Tree => ({
  ...base(),
  "topology.ts":
    "import { topology } from '@keel/server'\nexport default topology({ api: { modules: ['app'], adapter: 'node' } })\n",
  "modules/app/module.ts": manifestOf("app", deps),
  "libs/sup/package.json": SUP_PKG,
  "libs/sup/module.ts": manifestOf("sup", []),
  "libs/sup/.keel/ledger.json": LEDGER,
  "libs/sup/src/index.ts": "export { swallow } from './swallow.ts'\n",
  "libs/sup/src/swallow.ts": SWALLOW,
  ...(keys ? { "libs/sup/src/keys.ts": "export const k = Symbol.for('keel.x')\n" } : {}),
});
const pathOf = (r: { path?: unknown }): string => (typeof r.path === "string" ? r.path : "");

let linkedDir = "";
let plainDir = "";
let linked: ReturnType<typeof keel> | undefined;
let plain: ReturnType<typeof keel> | undefined;
beforeAll(() => {
  linkedDir = materialize(tree(["@fx/sup"], true));
  mkdirSync(join(linkedDir, "node_modules", "@fx"), { recursive: true });
  symlinkSync(join(linkedDir, "libs", "sup"), join(linkedDir, "node_modules", "@fx", "sup"));
  linked = keel(linkedDir, ["check"]);
  plainDir = materialize(tree([], false));
  plain = keel(plainDir, ["check"]);
}, SLOW);
afterAll(() => {
  cleanup(linkedDir);
  cleanup(plainDir);
});

describe("k.supervise Who writes it: a workspace library", () => {
  it("with `'@fx/sup'` in `deps` and `node_modules/@fx/sup` a link to `libs/sup`, `keel check` reports no E1461 in `libs/sup/src/swallow.ts` or at `node_modules/@fx/sup/src/swallow.ts`", () => {
    if (linked === undefined) throw new Error("keel check did not run");
    const paths = diags(linked, "E1461").map(pathOf);
    expect(paths).not.toContain("libs/sup/src/swallow.ts");
    expect(paths).not.toContain("node_modules/@fx/sup/src/swallow.ts");
  });

  it("there, each diagnostic of a library file is reported once, at its `node_modules/@fx/sup/` path", () => {
    if (linked === undefined) throw new Error("keel check did not run");
    const keys = diags(linked, "E1766").map(pathOf);
    expect(keys).toEqual(["node_modules/@fx/sup/src/keys.ts"]);
    expect(linked.records.map(pathOf).filter((p) => p.startsWith("libs/sup/"))).toEqual([]);
  });

  it("when no manifest lists `@fx/sup`, `keel check` reports no E1461 in `libs/sup/src/swallow.ts`", () => {
    if (plain === undefined) throw new Error("keel check did not run");
    expect(diags(plain, "E1461").map(pathOf)).not.toContain("libs/sup/src/swallow.ts");
  });
});
