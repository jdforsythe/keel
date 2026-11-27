// k.library the two clauses on a library's manifest and ids, each quoted whole
// Spec: k.library, clause "In that project, `deps: ['shop']` in the library's `module.ts` is one E1163 at the entry; `deps: ['@acme/other']`, naming a library holding the same files with `id: 'other'`, is not."
// Spec: k.library, clause "In that project, with `modules/charts/module.ts` an app module of id `charts`, `keel check` reports one E1166 at the `'@acme/charts'` entry, message `module id charts is held by charts and @acme/charts`."
// Rules: E1163 "a library file whose relative import, re-export or literal `import()` resolves outside its package folder, at the specifier, or a library manifest `deps` entry that does not begin with `@`, at the entry" (the manifest half; the import half is in library-rules.test.ts)
// Rules: E1166 "a library whose `id` is a project module's id or another of the app's libraries' ids, at each `deps` entry that names one of them (message `module id <id> is held by <a> and <b>`)"
// "That project" is the first Conformance clause of k.library, as `check()` files: `modules/shop/module.ts` listing `'@acme/charts'`, the library's files under `node_modules/@acme/charts/`.
// Seed 1337
// ASSUMPTIONS (spec silent): `check()` reads a library's `package.json` from the files it is given, at `node_modules/<name>/package.json`; the library's ledger file is
// given too; "at the entry" is a position on the entry's line from the opening quote to the end of the entry. A diagnostic in a library file carries no `fix` (k.library In an app).
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { type Files, SEED, lowerId, manifestFile } from "./module-support.ts";

const NO_TYPES = { types: false } as const;
const LIB = "node_modules/@acme/charts";

const scoped = fc.tuple(lowerId, lowerId).map(([scope, name]) => `@${scope}/${name}`);
const LEDGER = `${JSON.stringify({ version: 1, unsafe: 0, hostElements: 0, rungs: {}, mutation: {}, exports: [], clauses: [], a11y: [] })}\n`;

/** A library package at `node_modules/<name>/`: its `package.json`, a `module.ts` of `id` and `deps`, its source and its ledger file. */
function library(name: string, id: string, deps: string[] = []): Files {
  const root = `node_modules/${name}`;
  return [
    {
      path: `${root}/package.json`,
      source: JSON.stringify({
        name,
        version: "1.0.0",
        type: "module",
        keel: "library",
        exports: { ".": { keel: "./src/index.ts", default: "./index.js" } },
      }),
    },
    { path: `${root}/index.js`, source: "export {}\n" },
    manifestFile({ id, deps, exports: ["Badge"] }, root),
    { path: `${root}/src/index.ts`, source: "export { default as Badge } from './Badge.tsx'\n" },
    {
      path: `${root}/src/Badge.tsx`,
      source:
        "import { Box } from '@keel/ui'\nexport default function Badge(props: { id: string }) { return <Box id={`${props.id}.box`} /> }\n",
    },
    { path: `${root}/.keel/ledger.json`, source: LEDGER },
  ];
}

/** `modules/shop` listing `libs` in `deps` and importing `Badge` from the first of them. */
const shop = (libs: string[]): Files => [
  manifestFile({ id: "shop", deps: libs }),
  {
    path: "modules/shop/Page.tsx",
    source: `import { Badge } from '${libs[0] ?? "@acme/charts"}'\nexport default function Page() { return <Badge id="shop.badge" /> }\n`,
  },
];

const codesOf = (files: Files, code: string) => check(files, NO_TYPES).diagnostics.filter((d) => d.code === code);

/** Whether `line`/`col` lie on the `'entry'` of `source`, from its opening quote to its closing one. */
function atEntry(source: string, entry: string, line: number, col: number): boolean {
  const idx = source.indexOf(`'${entry}'`);
  if (idx < 0) return false;
  const before = source.slice(0, idx);
  const wantLine = before.split("\n").length;
  const quoteCol = idx - before.lastIndexOf("\n");
  return line === wantLine && col >= quoteCol && col <= quoteCol + entry.length + 1;
}
const sourceOf = (files: Files, path: string): string => files.find((f) => f.path === path)?.source ?? "";

test("In that project, `deps: ['shop']` in the library's `module.ts` is one E1163 at the entry", () => {
  const files = [...shop(["@acme/charts"]), ...library("@acme/charts", "charts", ["shop"])];
  const d = codesOf(files, "E1163");
  expect(d.length).toBe(1);
  expect(d[0]?.path).toBe(`${LIB}/module.ts`);
  expect(atEntry(sourceOf(files, `${LIB}/module.ts`), "shop", d[0]?.line ?? 0, d[0]?.col ?? 0)).toBe(true);
});

test("E1163: every library manifest `deps` entry that does not begin with `@` is one E1163 at its own entry, whatever the entry names, with no fix", () => {
  fc.assert(
    fc.property(fc.uniqueArray(lowerId, { minLength: 1, maxLength: 4 }), (entries) => {
      const files = [...shop(["@acme/charts"]), ...library("@acme/charts", "charts", entries)];
      const d = codesOf(files, "E1163");
      expect(d.length).toBe(entries.length);
      const src = sourceOf(files, `${LIB}/module.ts`);
      for (const e of entries) {
        expect(d.some((x) => x.path === `${LIB}/module.ts` && atEntry(src, e, x.line, x.col))).toBe(true);
      }
      for (const x of d) expect(x.fix).toBeUndefined();
    }),
    { seed: SEED, numRuns: 25 },
  );
});

test("In that project, `deps: ['@acme/other']`, naming a library holding the same files with `id: 'other'`, is not an E1163", () => {
  const files = [
    ...shop(["@acme/charts"]),
    ...library("@acme/charts", "charts", ["@acme/other"]),
    ...library("@acme/other", "other"),
  ];
  expect(codesOf(files, "E1163")).toEqual([]);
});

test("E1163: a library manifest `deps` entry that begins with `@` is never an E1163, whatever package it names; the entries that do not are, one each", () => {
  fc.assert(
    fc.property(
      fc.uniqueArray(scoped, { minLength: 1, maxLength: 3 }),
      fc.uniqueArray(lowerId, { minLength: 0, maxLength: 3 }),
      (pkgs, plain) => {
        const named = pkgs.filter((p) => p !== "@acme/charts");
        const others = named.flatMap((p, i) => library(p, `lib${"abcdefgh"[i] ?? "z"}x`));
        const files = [
          ...shop(["@acme/charts"]),
          ...library("@acme/charts", "charts", [...named, ...plain]),
          ...others,
        ];
        expect(codesOf(files, "E1163").length).toBe(plain.length);
      },
    ),
    { seed: SEED, numRuns: 25 },
  );
});

test("In that project, with `modules/charts/module.ts` an app module of id `charts`, `keel check` reports one E1166 at the `'@acme/charts'` entry, message `module id charts is held by charts and @acme/charts`", () => {
  const files = [...shop(["@acme/charts"]), manifestFile({ id: "charts" }), ...library("@acme/charts", "charts")];
  const d = codesOf(files, "E1166");
  expect(d.length).toBe(1);
  expect(d[0]?.path).toBe("modules/shop/module.ts");
  expect(atEntry(sourceOf(files, "modules/shop/module.ts"), "@acme/charts", d[0]?.line ?? 0, d[0]?.col ?? 0)).toBe(
    true,
  );
  expect(d[0]?.message).toBe("module id charts is held by charts and @acme/charts");
});

test("E1166: a library whose `id` is a project module's id is one E1166 at the entry naming it, message `module id <id> is held by <a> and <b>`, for any id and package name", () => {
  fc.assert(
    fc.property(
      lowerId.filter((x) => x !== "shop"),
      scoped,
      (id, name) => {
        const files = [...shop([name]), manifestFile({ id }), ...library(name, id)];
        const d = codesOf(files, "E1166");
        expect(d.length).toBe(1);
        expect(d[0]?.path).toBe("modules/shop/module.ts");
        expect(atEntry(sourceOf(files, "modules/shop/module.ts"), name, d[0]?.line ?? 0, d[0]?.col ?? 0)).toBe(true);
        expect(d[0]?.message).toBe(`module id ${id} is held by ${id} and ${name}`);
      },
    ),
    { seed: SEED, numRuns: 25 },
  );
});

test("E1166: a library whose `id` no project module or other library holds reports none", () => {
  fc.assert(
    fc.property(
      fc.tuple(lowerId, lowerId).filter(([a, b]) => a !== b && a !== "shop" && b !== "shop"),
      scoped,
      ([libId, modId], name) => {
        const files = [...shop([name]), manifestFile({ id: modId }), ...library(name, libId)];
        expect(codesOf(files, "E1166")).toEqual([]);
      },
    ),
    { seed: SEED, numRuns: 25 },
  );
});

test("E1166: two of the app's libraries holding one `id` are one E1166 at each `deps` entry that names one of them", () => {
  fc.assert(
    fc.property(
      lowerId.filter((x) => x !== "shop"),
      fc.tuple(scoped, scoped).filter(([a, b]) => a !== b),
      (id, [a, b]) => {
        const files = [...shop([a, b]), ...library(a, id), ...library(b, id)];
        const d = codesOf(files, "E1166");
        expect(d.length).toBe(2);
        const src = sourceOf(files, "modules/shop/module.ts");
        for (const name of [a, b]) {
          expect(d.some((x) => x.path === "modules/shop/module.ts" && atEntry(src, name, x.line, x.col))).toBe(true);
        }
        for (const x of d) {
          expect([`module id ${id} is held by ${a} and ${b}`, `module id ${id} is held by ${b} and ${a}`]).toContain(
            x.message,
          );
        }
      },
    ),
    { seed: SEED, numRuns: 25 },
  );
});
