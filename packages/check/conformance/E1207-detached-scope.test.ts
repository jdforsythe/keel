// Spec: k.reactive, clause "E1207 fires on `scope(fn, { detached: true })` and on `scope(fn, opts)` in app code and in `packages/std-x/src/a.ts`, not on `scope(fn, { onError })` or in `packages/reactive/src/a.ts`."
// k.reactive, Rules "`scope` given `detached: true` or a non-literal options object is E1207 in app code, a library's files and an `unsafe(` range among them; a file under `packages/<p>/` with `<p>` a kernel package's folder (schema, reactive, store, runtime-dom, compiler, router, forms, ui, check, scaffold, testing, server, services, cli, ctx) is not judged"
// k.reactive, API "Having no `parent`, it escapes its creator's `uses` declarations and request store registry (k.store), so only a kernel package's own code creates one (E1207); state kept for a module's life lives in a module root (Module roots)."
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

// ---- E1207 finds `scope` by its symbol (k.unsafe One path) ----

const e1207Typed = (files: Files) => check(files).diagnostics.filter((d) => d.code === "E1207");
const DETACHED = "{ detached: true }";

test("E1207 finds `scope` by its symbol: an alias, a namespace member, a literal computed member and `Reflect.apply` of it are each one E1207", () => {
  const bodies = [
    `${HEAD}const sc = scope\nexport const w = sc(() => {}, ${DETACHED})\n`,
    `import * as r from '@keel/reactive'\nexport const w = r.scope(() => {}, ${DETACHED})\n`,
    `import * as r from '@keel/reactive'\nexport const w = r['scope'](() => {}, ${DETACHED})\n`,
    `${HEAD}export const w = Reflect.apply(scope, undefined, [() => {}, ${DETACHED}])\n`,
    `${HEAD}export const w = scope.call(undefined, () => {}, ${DETACHED})\n`,
  ];
  for (const source of bodies) expect(e1207Typed([MANIFEST, f(APP, source)]), source).toHaveLength(1);
});

test("a function named `scope` that is not `@keel/reactive`'s is no E1207, whatever it is called with", () => {
  const source = `function scope(fn: () => void, o: { detached: boolean }): void { fn(); void o }\nexport const w = scope(() => {}, ${DETACHED})\n`;
  expect(e1207Typed([MANIFEST, f(APP, source)])).toHaveLength(0);
});

test("`scope` used as a value any other way is one E1207 at the use, message `scope used other than as a call; check cannot follow it`, no fix", () => {
  for (const use of [
    "const held = scope\nexport const w = held",
    "declare function take(x: unknown): void\nexport const w = take(scope)",
  ]) {
    const ds = e1207Typed([MANIFEST, f(APP, `${HEAD}${use}\n`)]);
    expect(ds, use).toHaveLength(1);
    expect(ds[0]?.message).toBe("scope used other than as a call; check cannot follow it");
    expect(ds[0]?.fix).toBeUndefined();
  }
});

test("under `check(files, { types: false })` E1207 reads spellings only: a direct call is found, an alias is not", () => {
  expect(e1207(app(`scope(() => {}, ${DETACHED})`))).toHaveLength(1);
  expect(
    e1207([MANIFEST, f(APP, `${HEAD}const sc = scope\nexport const w = sc(() => {}, ${DETACHED})\n`)]),
  ).toHaveLength(0);
});

test("E1207 is judged in a library's files and in an `unsafe(` range, for each of a set of file names", () => {
  fc.assert(
    fc.property(fc.constantFrom("src/a.ts", "src/deep/b.ts", "unsafe/c.ts"), (file) => {
      const ROOT = "node_modules/@acme/charts";
      const LEDGER = `${JSON.stringify({ version: 1, unsafe: 0, hostElements: 0, rungs: {}, mutation: {}, exports: [], clauses: [], a11y: [] })}\n`;
      const files: Files = [
        f(
          "modules/shop/module.ts",
          `import { module } from '@keel/compiler'\nexport default module({ id: 'shop', deps: ['@acme/charts'], capabilities: [], public: { exports: [] } })\n`,
        ),
        f(
          `${ROOT}/package.json`,
          JSON.stringify({ name: "@acme/charts", version: "1.0.0", type: "module", keel: "library" }),
        ),
        f(
          `${ROOT}/module.ts`,
          `import { module } from '@keel/compiler'\nexport default module({ id: 'charts', deps: [], capabilities: [], public: { exports: [] } })\n`,
        ),
        f(`${ROOT}/.keel/ledger.json`, LEDGER),
        f(`${ROOT}/${file}`, src(`scope(() => {}, ${DETACHED})`)),
      ];
      expect(e1207(files).filter((d) => d.path === `${ROOT}/${file}`)).toHaveLength(1);
    }),
    { seed: SEED, numRuns: 10 },
  );
});
