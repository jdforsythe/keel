// Spec: k.formats, clause "Let `EVEN` be `import { s } from '@keel/schema'` then `export const Even = s.format('units.even', s.int(), { check: (v) => v % 2 === 0, gen: { from: s.int(), map: (n) => n * 2 } })`. In a project whose `modules/shop/module.ts` lists `'@acme/units'` in `deps` and whose `node_modules/@acme/units/` holds `package.json` `{\"name\":\"@acme/units\",\"version\":\"1.0.0\",\"type\":\"module\",\"keel\":\"library\"}` and a `module.ts` with `id: 'units'`, `deps: []`, `capabilities: []` and `public: { exports: ['Even'] }`, `check()` reports no E1106 for `EVEN` in `node_modules/@acme/units/src/Even.schema.ts`, in `node_modules/@acme/units/unsafe/Even.schema.ts` or in `modules/shop/Even.test.ts`, and one E1106 for `EVEN` in `modules/shop/Even.schema.ts`."
// Seed 1337.
// Fixture libraries are written into the project's `node_modules/`; no std package is imported.
// ASSUMPTION (spec silent): `unsafe/` files are given as plain files (no `unsafe(` lift), since the clause names none.
import { check } from "@keel/check";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type Files, manifestFile } from "./module-support.ts";
import { SEED } from "./support.ts";
import { freshDir, linkAt, removeDir, rootOption, writeTree } from "./security-support.ts";

const ROOT = "node_modules/@acme/units";
const even = (name: string): string =>
  `import { s } from '@keel/schema'\nexport const Even = s.format('${name}', s.int(), { check: (v) => v % 2 === 0, gen: { from: s.int(), map: (n) => n * 2 } })\n`;
const EVEN = even("units.even");

/** The project of the clause: module `shop` listing `@acme/units`, the library installed, plus `extra` files. */
function project(extra: Files): Files {
  return [
    manifestFile({ id: "shop", deps: ["@acme/units"] }),
    {
      path: `${ROOT}/package.json`,
      source: JSON.stringify({ name: "@acme/units", version: "1.0.0", type: "module", keel: "library" }),
    },
    manifestFile({ id: "units", deps: [], exports: ["Even"] }, ROOT),
    ...extra,
  ];
}
const e1106 = (files: Files): string[] =>
  check(files, { types: false })
    .diagnostics.filter((d) => d.code === "E1106")
    .map((d) => d.path);

describe("E1106 and a library's files", () => {
  it("E1106: `s.format` in `node_modules/@acme/units/src/Even.schema.ts` of a library the app lists reports no E1106", () => {
    expect(e1106(project([{ path: `${ROOT}/src/Even.schema.ts`, source: EVEN }]))).toEqual([]);
  });

  it("E1106: `s.format` in `node_modules/@acme/units/unsafe/Even.schema.ts` of a library the app lists reports no E1106", () => {
    expect(e1106(project([{ path: `${ROOT}/unsafe/Even.schema.ts`, source: EVEN }]))).toEqual([]);
  });

  it("E1106: for any format name, `s.format` in a library's `src/` or `unsafe/` file reports no E1106", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{3,8}\.[a-z]{3,8}$/), fc.constantFrom("src", "unsafe"), (name, dir) => {
        expect(e1106(project([{ path: `${ROOT}/${dir}/Even.schema.ts`, source: even(name) }]))).toEqual([]);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("E1106: `s.format` in `modules/shop/Even.test.ts` reports no E1106 (test code is no app code)", () => {
    expect(e1106(project([{ path: "modules/shop/Even.test.ts", source: EVEN }]))).toEqual([]);
  });

  it("E1106: `s.format` in `modules/shop/Even.schema.ts` reports one E1106", () => {
    expect(e1106(project([{ path: "modules/shop/Even.schema.ts", source: EVEN }]))).toEqual([
      "modules/shop/Even.schema.ts",
    ]);
  });

  it("E1106: with the library's files and the app's file all holding `EVEN`, the one E1106 is the app's", () => {
    const files = project([
      { path: `${ROOT}/src/Even.schema.ts`, source: EVEN },
      { path: `${ROOT}/unsafe/Even.schema.ts`, source: EVEN },
      { path: "modules/shop/Even.test.ts", source: EVEN },
      { path: "modules/shop/Even.schema.ts", source: EVEN },
    ]);
    expect(e1106(files)).toEqual(["modules/shop/Even.schema.ts"]);
  });

  // ASSUMPTION (spec silent on how a link is given to check()): the library's real folder is `<root>/libs/units`, `<root>/node_modules/@acme/units` is a symlink to it, and the files are passed at the `node_modules/` path with `root` the project folder.
  it("E1106: `s.format` in `src/Even.schema.ts` of a workspace-linked library the app lists reports no E1106", () => {
    const dir = freshDir("keel-e1106");
    try {
      const lib = project([{ path: `${ROOT}/src/Even.schema.ts`, source: EVEN }]).filter((f) => f.path.startsWith(ROOT));
      writeTree(join(dir, "libs", "units"), lib.map((f) => ({ path: f.path.slice(`${ROOT}/`.length), source: f.source })));
      mkdirSync(dirname(join(dir, ROOT)), { recursive: true });
      linkAt(dir, ROOT, join(dir, "libs", "units"));
      const files = project([{ path: `${ROOT}/src/Even.schema.ts`, source: EVEN }]);
      const out = check(files, { types: false, root: rootOption(dir) }).diagnostics.filter((d) => d.code === "E1106");
      expect(out.map((d) => d.path)).toEqual([]);
    } finally {
      removeDir(dir);
    }
  });
});
