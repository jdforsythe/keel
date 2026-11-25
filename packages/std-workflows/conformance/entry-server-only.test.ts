// Spec: std.workflows, clause "In a project with no `topology.ts` whose module `shop` lists `'@keel/std-workflows'` in `deps`, `keel check` reports one E1004 at `import { workflow } from '@keel/std-workflows'` in `modules/shop/flows.ts`, none for it in `modules/shop/flows.server.ts`, and none for `import type { Workflow } from '@keel/std-workflows'` in `modules/shop/flows.ts`."
// Seed 1337 (no generated input).
// ASSUMPTION: the project is `check()` over in-memory files: the package's own manifest, `module.ts`, ledger file and `src/` read from its folder into `node_modules/@keel/std-workflows/`, so the entry is the one `package.json` `exports` names; only E1004 at the two shop files is read.
// ASSUMPTION: "at the import" is the import's line (line 1); the files import nothing else.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { check } from "@keel/check";
import { expect, test } from "vitest";

type Files = Parameters<typeof check>[0];
const PKG = join(import.meta.dirname, "..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const packageFiles: Files = [
  ...["package.json", "module.ts", ".keel/ledger.json"].map((f) => join(PKG, f)),
  ...walk(join(PKG, "src")),
].map((p) => ({ path: `node_modules/@keel/std-workflows/${relative(PKG, p)}`, source: readFileSync(p, "utf8") }));

const MANIFEST = {
  path: "modules/shop/module.ts",
  source: `import { module } from '@keel/compiler'\nexport default module({ id: 'shop', deps: ['@keel/std-workflows'], capabilities: [], public: { exports: [] } })\n`,
};
const project = (files: Files): Files => [MANIFEST, ...files, ...packageFiles];
const e1004 = (files: Files) => check(project(files), { types: false }).diagnostics.filter((d) => d.code === "E1004");
const VALUE = "import { workflow } from '@keel/std-workflows'\nexport const w = workflow\n";

test("with no `topology.ts` and `@keel/std-workflows` in `shop`'s `deps`, `import { workflow } from '@keel/std-workflows'` in `modules/shop/flows.ts` is one E1004, at the import", () => {
  const d = e1004([{ path: "modules/shop/flows.ts", source: VALUE }]);
  expect(d).toHaveLength(1);
  expect(d[0]?.path).toBe("modules/shop/flows.ts");
  expect(d[0]?.line).toBe(1);
});

test("the same import in `modules/shop/flows.server.ts` is no E1004", () => {
  expect(e1004([{ path: "modules/shop/flows.server.ts", source: VALUE }])).toEqual([]);
});

test("`import type { Workflow } from '@keel/std-workflows'` in `modules/shop/flows.ts` is no E1004", () => {
  const src = "import type { Workflow } from '@keel/std-workflows'\nexport type W = Workflow\n";
  expect(e1004([{ path: "modules/shop/flows.ts", source: src }])).toEqual([]);
});
