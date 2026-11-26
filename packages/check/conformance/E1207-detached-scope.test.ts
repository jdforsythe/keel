// Spec: k.reactive, clause "E1207 fires on `scope(fn, { detached: true })` and on `scope(fn, opts)` in app code and in `packages/std-x/src/a.ts`, not on `scope(fn, { onError })` or in `packages/reactive/src/a.ts`."
// Seed 1337
// E1207 has no fix; the no-fix list in fix-diffs.test.ts records it.
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import type { Files } from "./support.ts";
import { SEED } from "./support.ts";

const f = (path: string, source: string): Files[number] => ({ path, source });
const MANIFEST = f(
  "modules/app/module.ts",
  `import { module } from '@keel/compiler'\nexport default module({ id: 'app', deps: [], capabilities: [], public: { exports: [] } })\n`,
);
const e1207 = (files: Files) => check(files, { types: false }).diagnostics.filter((d) => d.code === "E1207");

const HEAD = `import { scope } from '@keel/reactive'\n`;
const APP = "modules/app/Work.ts";
const src = (call: string, pre = "") => `${HEAD}${pre}export const w = ${call}\n`;
const app = (call: string, pre = "") => [MANIFEST, f(APP, src(call, pre))];

test("E1207 fires on `scope(fn, { detached: true })` in app code", () => {
  const ds = e1207(app("scope(() => {}, { detached: true })"));
  expect(ds).toHaveLength(1);
  expect(ds[0]?.fix).toBeUndefined();
  expect(ds[0]?.see).toBe("k.reactive");
});

test("E1207 fires on `scope(fn, opts)` with an identifier options object in app code", () => {
  const ds = e1207(app("scope(() => {}, opts)", "declare const opts: { onError?: () => void }\n"));
  expect(ds).toHaveLength(1);
});

test("E1207 does not fire on `scope(fn, { onError })` in app code", () => {
  expect(e1207(app("scope(() => {}, { onError: () => {} })"))).toHaveLength(0);
  expect(e1207(app("scope(() => {}, { onError })", "const onError = () => {}\n"))).toHaveLength(0);
});

test("E1207 does not fire on `scope(fn)` without options in app code", () => {
  expect(e1207(app("scope(() => {})"))).toHaveLength(0);
});

test("E1207 fires on `scope` through an aliased import with `detached: true`", () => {
  const files = [
    MANIFEST,
    f(APP, `import { scope as sc } from '@keel/reactive'\nexport const w = sc(() => {}, { detached: true })\n`),
  ];
  expect(e1207(files)).toHaveLength(1);
});

const KERNEL = [
  "schema",
  "reactive",
  "store",
  "runtime-dom",
  "compiler",
  "router",
  "forms",
  "ui",
  "check",
  "scaffold",
  "testing",
  "server",
  "services",
  "cli",
  "ctx",
];

test("E1207 does not fire on `detached: true` or `scope(fn, opts)` in `packages/reactive/src/a.ts`", () => {
  const pre = "declare const opts: { detached: boolean }\n";
  expect(e1207([f("packages/reactive/src/a.ts", src("scope(() => {}, { detached: true })"))])).toHaveLength(0);
  expect(e1207([f("packages/reactive/src/a.ts", src("scope(() => {}, opts)", pre))])).toHaveLength(0);
});

test("E1207 fires on `scope(fn, { detached: true })` and on `scope(fn, opts)` in `packages/std-x/src/a.ts`", () => {
  const pre = "declare const opts: { detached: boolean }\n";
  const a = e1207([f("packages/std-x/src/a.ts", src("scope(() => {}, { detached: true })"))]);
  expect(a).toHaveLength(1);
  expect(a[0]?.fix).toBeUndefined();
  expect(e1207([f("packages/std-x/src/a.ts", src("scope(() => {}, opts)", pre))])).toHaveLength(1);
  expect(e1207([f("packages/std-x/src/a.ts", src("scope(() => {}, { onError: () => {} })"))])).toHaveLength(0);
});

// Seed 1337
test("Property: E1207 is not judged in `packages/<p>/` for each of the fifteen kernel folders and is judged in any other package folder", () => {
  const other = fc.constantFrom("std-x", "std-sessions", "std-db", "acme", "keel", "reactive-extra", "schemas");
  fc.assert(
    fc.property(
      fc.constantFrom(...KERNEL),
      other,
      fc.constantFrom("src/a.ts", "src/deep/b.ts", "unsafe/c.ts"),
      (kernel, foreign, file) => {
        const call = "scope(() => {}, { detached: true })";
        expect(e1207([f(`packages/${kernel}/${file}`, src(call))])).toHaveLength(0);
        expect(e1207([f(`packages/${foreign}/${file}`, src(call))])).toHaveLength(1);
      },
    ),
    { seed: SEED, numRuns: 60 },
  );
});

// Seed 1337
test("Property: over option-bearing calls, app code reports E1207 exactly for `detached: true` or a non-literal options object", () => {
  const cases = fc.constantFrom(
    { opts: "{ detached: true }", pre: "", fires: true },
    { opts: "opts", pre: "declare const opts: object\n", fires: true },
    { opts: "{ onError: () => {} }", pre: "", fires: false },
    { opts: "{ onError }", pre: "const onError = () => {}\n", fires: false },
  );
  fc.assert(
    fc.property(cases, fc.constantFrom("w", "run", "job"), (c, name) => {
      const file = f(APP, `${HEAD}${c.pre}export const ${name} = scope(() => {}, ${c.opts})\n`);
      expect(e1207([MANIFEST, file])).toHaveLength(c.fires ? 1 : 0);
    }),
    { seed: SEED, numRuns: 30 },
  );
});
