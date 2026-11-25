import { check } from "@keel/check";
// Spec: k.module, clause "Let `X` be a library under `node_modules/@acme/x/`: `package.json` `{\"name\":\"@acme/x\",\"version\":\"1.0.0\",\"type\":\"module\",\"keel\":\"library\",\"exports\":{\".\":\"./src/index.ts\",\"./server\":\"./src/server.ts\",\"./tools\":\"./src/tools/index.ts\",\"./*\":\"./src/*.ts\"}}`, a `module.ts` with `id: 'x'`, `deps: []`, `capabilities: []` and `public: { exports: [] }`, and `src/index.ts`, `src/server.ts`, `src/tools/index.ts` and `src/Hidden.ts` each `export const f = 1`. In a project holding `X`, `import { f } from '@acme/x/server'` in `modules/shop/a.server.ts` and `import { f } from '@acme/x/tools'` in `modules/shop/rule.ts` report no E1151 while module `shop` lists `'@acme/x'` in `deps`, and one E1152 each and no E1151 when its `deps` is `[]`; `import { f } from '@acme/x/Hidden'` in `modules/shop/a.ts` reports one E1151 at the import, and none once `X`'s `public.exports` is `['Hidden']`."
// Seed 1337
// ASSUMPTION: the bullet's E1151 for `Hidden` is reported at the import's line (line 1, the import is the first line); the fix of a library file's E1151 is not asserted (k.module: no fix edits `node_modules/`).
// ASSUMPTION: an entry named whole in `exports` beyond the bullet's two (`./<e>`) is an entry too (the Rules sentence: "a subpath the library's `package.json` `exports` names as written, with no `*`").
import fc from "fast-check";
import { expect, test } from "vitest";
import { type Files, SEED, lowerId, manifestFile } from "./module-support.ts";

const ROOT = "node_modules/@acme/x";
const LEDGER = `${JSON.stringify({ version: 1, unsafe: 0, hostElements: 0, rungs: {}, mutation: {}, exports: [], clauses: [], a11y: [] })}\n`;
const F = "export const f = 1\n";
const EXPORTS = {
  ".": "./src/index.ts",
  "./server": "./src/server.ts",
  "./tools": "./src/tools/index.ts",
  "./*": "./src/*.ts",
};

function libraryX(
  exportsMap: Record<string, string> = EXPORTS,
  publicExports: string[] = [],
  extra: Files = [],
): Files {
  return [
    {
      path: `${ROOT}/package.json`,
      source: JSON.stringify({
        name: "@acme/x",
        version: "1.0.0",
        type: "module",
        keel: "library",
        exports: exportsMap,
      }),
    },
    manifestFile({ id: "x", deps: [], capabilities: [], exports: publicExports }, ROOT),
    { path: `${ROOT}/src/index.ts`, source: F },
    { path: `${ROOT}/src/server.ts`, source: F },
    { path: `${ROOT}/src/tools/index.ts`, source: F },
    { path: `${ROOT}/src/Hidden.ts`, source: F },
    { path: `${ROOT}/.keel/ledger.json`, source: LEDGER },
    ...extra,
  ];
}
const imp = (spec: string) => `import { f } from '${spec}'\nexport const g = f\n`;
function project(deps: string[], libs: Files, files: Files): Files {
  return [manifestFile({ id: "shop", deps }), ...files, ...libs];
}
const SERVER: Files = [{ path: "modules/shop/a.server.ts", source: imp("@acme/x/server") }];
const TOOLS: Files = [{ path: "modules/shop/rule.ts", source: imp("@acme/x/tools") }];
const both = [...SERVER, ...TOOLS];
const hits = (files: Files, code: string) => check(files, { types: false }).diagnostics.filter((d) => d.code === code);

test("`import { f } from '@acme/x/server'` in `modules/shop/a.server.ts` and `import { f } from '@acme/x/tools'` in `modules/shop/rule.ts` report no E1151 while module `shop` lists `'@acme/x'` in `deps`", () => {
  const files = project(["@acme/x"], libraryX(), both);
  expect(hits(files, "E1151")).toEqual([]);
  expect(hits(files, "E1152")).toEqual([]);
});

test("the same two imports report one E1152 each and no E1151 when `shop`'s `deps` is `[]`", () => {
  const files = project([], libraryX(), both);
  expect(hits(files, "E1151")).toEqual([]);
  const d = hits(files, "E1152");
  expect(d.map((x) => x.path).sort()).toEqual(["modules/shop/a.server.ts", "modules/shop/rule.ts"]);
});

test("`import { f } from '@acme/x/Hidden'` in `modules/shop/a.ts` reports one E1151 at the import", () => {
  const files = project(["@acme/x"], libraryX(), [{ path: "modules/shop/a.ts", source: imp("@acme/x/Hidden") }]);
  const d = hits(files, "E1151");
  expect(d).toHaveLength(1);
  expect(d[0]?.path).toBe("modules/shop/a.ts");
  expect(d[0]?.line).toBe(1);
});

test("`import { f } from '@acme/x/Hidden'` reports no E1151 once `X`'s `public.exports` is `['Hidden']`", () => {
  const files = project(["@acme/x"], libraryX(EXPORTS, ["Hidden"]), [
    { path: "modules/shop/a.ts", source: imp("@acme/x/Hidden") },
  ]);
  expect(hits(files, "E1151")).toEqual([]);
});

test("an entry the `exports` map names whole, whatever its name, is no E1151 while `public.exports` lists nothing; a file one `./*` reaches is", () => {
  fc.assert(
    fc.property(
      lowerId.filter((n) => n !== "hidden" && n !== "server" && n !== "tools" && n !== "index"),
      (e) => {
        const map = { ...EXPORTS, [`./${e}`]: `./src/${e}.ts` };
        const extra: Files = [{ path: `${ROOT}/src/${e}.ts`, source: F }];
        const asEntry = project(["@acme/x"], libraryX(map, [], extra), [
          { path: "modules/shop/a.ts", source: imp(`@acme/x/${e}`) },
        ]);
        expect(hits(asEntry, "E1151")).toEqual([]);
        // the same file reached only through the `./*` pattern is a file, judged by its stem
        const asFile = project(["@acme/x"], libraryX(EXPORTS, [], extra), [
          { path: "modules/shop/a.ts", source: imp(`@acme/x/${e}`) },
        ]);
        expect(hits(asFile, "E1151")).toHaveLength(1);
      },
    ),
    { seed: SEED, numRuns: 10 },
  );
});
