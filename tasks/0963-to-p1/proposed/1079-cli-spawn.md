# 1079: cheaper cli spawn conformance (proposed conformance changes)

For a conformance writer to apply under an `rfc:` tag. Each change keeps the clause's range and cuts `keel` spawns per file. Every change below was run as a scratch copy under `packages/cli/test/` (with this lane's product changes) and passed.

## Where the time went

Each spawn is a cold `node packages/cli/src/bin.ts`: about 0.6 s of CPU loading and stripping the cli's TypeScript module graph, then the command. `keel check` runs the strict type pass, a cold TypeScript program over about 1000 kernel source files and the TS libs (3.9 MB, about 2 s CPU). `keel build` runs that same check first, then the routes evaluation and the surface's Vite SSR evaluation. No Vite build runs for these projects (no `vite.config.ts`). So one `e1562` case (base build, build, check) is three cold starts and three type passes, and the files repeat it 5 to 21 times.

| file | spawns | each spawn |
| --- | --- | --- |
| compat-accepts-property | 36 (2 tests x 6 runs x build, build, check) | build or check, a cold type pass each |
| compat-0092 | 38 | test 2: 3 runs x (base build, build, 5 checks of one unchanged tree) |
| E1562-base-output-removed | 15 (3 runs x 5) | builds and checks of one tree, rebuilt per run |
| surface-normal-sources | about 90 | `check` then `build` of the same edited tree |

The lane's product changes (committed): `keel check` keeps type-pass results on disk (`node_modules/.cache/keel`, checked against every read file's mtime), so a `check` after a `build` of the same tree skips the program; the `keel` binary starts under Node's compile cache. Per-file runs below.

## Proposed changes

1. `packages/cli/conformance/compat-support.ts`: add `projectMany`, `e1562Of` and `baseSurfaceOnce` (end of file). `projectMany` puts many entries in one contract (`y.add<i>` POST bodies, `y.load<j>` GET outputs, one handler file each), so one build judges every pair; an E1562 message starts with its entry id. `baseSurfaceOnce` builds each distinct base tree once per file.
2. `packages/cli/conformance/compat-accepts-property.test.ts`: each test is one run over an array of 6 pairs (`fc.array(pair, { minLength: 6, maxLength: 6 })`, `numRuns: 1`) in one `projectMany` project. The same 6 pairs per test are drawn from the same arbitraries as the six runs, and each accepted pair still gets 20 `gen(B)` values. Spawns: 36 to 6.
3. `packages/cli/conformance/E1562-base-output-removed.test.ts`: the three fields (`title`, `total`, `status`, the old `constantFrom`) become three entries `y.load0..2` of one project, all checked in one pass (before, `numRuns: 3` over `constantFrom` could repeat a field). Spawns: 15 to 5.
4. `packages/cli/conformance/compat-0092.test.ts:59`: `baseSurface` becomes `baseSurfaceOnce` (the `NAME` base is the same in every run; the case rebuilds its tree before any check). Spawns: 3 fewer.
5. `packages/cli/conformance/E1562-base-route-change.test.ts:35,52,64,71`: `baseSurface` becomes `baseSurfaceOnce` (two distinct bases, four builds become two).

`surface-normal-sources` needs no change: the type cache makes each `build` after its `check` skip the type pass.

## Measured (each file alone, this machine, load 33 to 97 on 16 cores)

| file | before | product changes | + proposals |
| --- | --- | --- | --- |
| E1562-base-output-removed | 57.5 s (load 43) | 32.5 s (51) | 4.5 s (56) |
| compat-0092 | 118.1 s (42) | 45.9 s (72) | 22.9 s (53) |
| compat-accepts-property | 147.7 s (85) | 52.6 s (56) | 6.1 s (40) |
| surface-normal-sources | 286.9 s (97) | 125.4 s (46) | (no change) |
| E1562-base-route-change | n/a | 16.3 s (33) | 12.1 s (38) |

## Bound rule (proposed, not built)

There is no per-file number. `keelConfig` measures one cold `node packages/cli/src/bin.ts --version` at suite start and scales `testTimeout` by `max(1, measured / 0.25 s)`, clamped to 8. That one wall measurement takes in both a busy machine and a slower CPU. On CI's runner (about 5x slower, unloaded) the factor is about 5, so a 120 s bound becomes about 600 s. A file is then bounded by its work (spawns x cold start) and not by the load.

## The diff

```diff
--- a/packages/cli/conformance/compat-support.ts
+++ b/packages/cli/conformance/compat-support.ts
@@ -191,3 +191,71 @@
   writeFileSync(base, readFileSync(join(dir, ".keel/surface.json"), "utf8"));
   return { dir, base };
 }
+
+/** The entries of `projectMany`: one POST entry per `bodies` item, one GET entry per `outputs` item (schema, value). */
+export type Many = {
+  readonly bodies?: readonly string[];
+  readonly outputs?: readonly (readonly [schema: string, value: string])[];
+};
+
+/**
+ * The project of `project({ split: true })` whose contract `y` holds many entries instead of `y.add` and `y.load`: `y.add<i>`
+ * (POST `/y/add<i>`, `body` the i-th of `bodies`, output `ACTION_ANSWER`) and `y.load<j>` (GET `/y/load<j>`, the j-th
+ * output), each bound in `routes.ts` to its own file. One build then judges every entry: an E1562 names its entry first.
+ */
+export function projectMany(m: Many): Tree {
+  const bodies = m.bodies ?? [];
+  const outputs = m.outputs ?? [];
+  const head = `import { ok } from '@keel/schema'\nimport { y } from './y.contract.ts'\n`;
+  const files: Tree = {};
+  for (const [k, v] of Object.entries(project({ split: true })))
+    if (!k.startsWith("modules/y/") || k === "modules/y/module.ts") files[k] = v;
+  const entries = [
+    ...bodies.map((b, i) => `  'y.add${i}': { method: 'POST', path: '/y/add${i}', body: ${b}, output: ${ACTION_ANSWER} },\n`),
+    ...outputs.map(([o], j) => `  'y.load${j}': { method: 'GET', path: '/y/load${j}', output: ${o} },\n`),
+  ];
+  files["modules/y/y.contract.ts"] =
+    `import { contract } from '@keel/router/contract'\nimport { s } from '@keel/schema'\n` +
+    `export const y = contract('y', {\n${entries.join("")}})\n`;
+  bodies.forEach((_, i) => {
+    files[`modules/y/add${i}.server.ts`] =
+      `import { action } from '@keel/router'\n${head}export const add${i} = action(y, 'y.add${i}', {}, async () => ok(null))\n`;
+  });
+  outputs.forEach(([, value], j) => {
+    files[`modules/y/load${j}.server.ts`] =
+      `import { loader } from '@keel/router'\n${head}export const load${j} = loader(y, 'y.load${j}', {}, async () => ok(${value}))\n`;
+  });
+  const names = [...bodies.map((_, i) => `add${i}`), ...outputs.map((_, j) => `load${j}`)];
+  files["modules/y/routes.ts"] =
+    `import { manifest } from '@keel/router'\nimport { y } from './y.contract.ts'\n` +
+    names.map((n) => `import { ${n} } from './${n}.server.ts'\n`).join("") +
+    `export const routes = manifest(y, { ${[
+      ...bodies.map((_, i) => `'y.add${i}': { action: add${i} }`),
+      ...outputs.map((_, j) => `'y.load${j}': { loader: load${j} }`),
+    ].join(", ")} })\n`;
+  return files;
+}
+
+/** The E1562 records of `run` naming entry `id` (its message starts with the id). */
+export const e1562Of = (run: Run, id: string): Rec[] =>
+  diags(run, "E1562").filter((d) => String(d.message).startsWith(`${id} `));
+
+/**
+ * `baseSurface` once per distinct `files` in this process: a repeated base is a fresh copy of the files beside the
+ * surface the first build wrote, so a case that rebuilds its project sees the base it asked for without a build.
+ * For callers that rebuild the returned project before they read it.
+ */
+const bases = new Map<string, string>();
+export function baseSurfaceOnce(files: Tree): { dir: string; base: string } {
+  const key = JSON.stringify(Object.entries(files).sort(([a], [b]) => (a < b ? -1 : 1)));
+  const known = bases.get(key);
+  if (known !== undefined) {
+    const dir = materialize(files);
+    const base = join(dir, "..", `${dir.split("/").pop()}-base.json`);
+    writeFileSync(base, known);
+    return { dir, base };
+  }
+  const built = baseSurface(files);
+  bases.set(key, readFileSync(built.base, "utf8"));
+  return built;
+}
--- a/packages/cli/conformance/compat-accepts-property.test.ts
+++ b/packages/cli/conformance/compat-accepts-property.test.ts
@@ -1,16 +1,19 @@
 // Spec: k.compat, clause "For generated pairs of schemas, when `A` accepts `B`, every value `gen(B)` yields parses with `A`."
 // Seed 1337. `accepts` is not exported, so it is observed through E1562: the base entry's `body` is `B`, the current entry's is `A`, the caller in
-// another deployable; no E1562 means the check decided `A` accepts `B` (k.compat Base). Slow (two project builds per run), so numRuns is small.
+// another deployable; no E1562 means the check decided `A` accepts `B` (k.compat Base). Each run is a batch of pairs, one entry `y.add<i>` per pair in
+// one project (`projectMany`), so a run is two builds and one check whatever its size.
 // Schemas: s.string(), s.number(), s.enum([...]), s.array(x), s.object({...}), x.optional(), x.nullable(); the top level is an
 // object (an action's `input` is an object schema). Only the entry's `body` differs between base and current.
 // `gen(B)` values of an open object carry extra keys of any type (k.compat Accepts: a field an open `B` lacks is accepted only if `A`'s field accepts any value).
 import { type Schema, s } from "@keel/schema";
 import fc from "fast-check";
 import { afterAll, expect, test } from "vitest";
-import { SEED, baseSurface, buildAndCheck, cleanup, diags, project, write } from "./compat-support.ts";
+import { SEED, baseSurface, buildAndCheck, cleanup, e1562Of, projectMany, write } from "./compat-support.ts";
 
-/** Property runs spawn several `keel build` and `keel check` processes each. */
+/** A run spawns two `keel build` and one `keel check`. */
 const SLOW = 120_000;
+/** Pairs per run: the six runs of one pair each, now one batch. */
+const PAIRS = 6;
 
 type D =
   | { k: "string" }
@@ -148,32 +151,37 @@
 afterAll(() => {
   for (const d of dirs) cleanup(d);
 });
-const e1562 = (a: D, b: D): number => {
-  const base = baseSurface(project({ body: src(b), split: true }));
+/** For each pair `[A, B]`, the E1562 count of the entry whose base `body` is `B` and current `body` is `A`. */
+const e1562 = (pairs: readonly (readonly [D, D])[]): number[] => {
+  const base = baseSurface(projectMany({ bodies: pairs.map(([, b]) => src(b)) }));
   dirs.push(base.dir);
-  write(base.dir, project({ body: src(a), split: true }));
-  return diags(buildAndCheck(base.dir, base.base), "E1562").length;
+  write(base.dir, projectMany({ bodies: pairs.map(([a]) => src(a)) }));
+  const run = buildAndCheck(base.dir, base.base);
+  return pairs.map((_, i) => e1562Of(run, `y.add${i}`).length);
 };
 
 test(
   "For generated pairs of schemas, when `A` accepts `B`, every value `gen(B)` yields parses with `A`.",
   () => {
     let accepted = 0;
-    const pairs = fc.oneof(
+    const pair = fc.oneof(
       fc.tuple(objArb, objArb),
       objArb.map((b): [D, D] => [widen(b), b]),
     );
     fc.assert(
-      fc.property(pairs, ([a, b]) => {
-        if (e1562(a, b) > 0) return;
-        accepted++;
-        const target = build(a);
-        fc.assert(
-          fc.property(gen(b), (v) => target.parse(v).ok),
-          { seed: SEED, numRuns: 20 },
-        );
+      fc.property(fc.array(pair, { minLength: PAIRS, maxLength: PAIRS }), (pairs) => {
+        const found = e1562(pairs);
+        pairs.forEach(([a, b], i) => {
+          if ((found[i] ?? 0) > 0) return;
+          accepted++;
+          const target = build(a);
+          fc.assert(
+            fc.property(gen(b), (v) => target.parse(v).ok),
+            { seed: SEED, numRuns: 20 },
+          );
+        });
       }),
-      { seed: SEED, numRuns: 6 },
+      { seed: SEED, numRuns: 1 },
     );
     expect(accepted).toBeGreaterThan(0);
   },
@@ -184,10 +192,10 @@
   "a widening of `B` is accepted: no E1562 for A = widen(B)",
   () => {
     fc.assert(
-      fc.property(objArb, (b) => {
-        expect(e1562(widen(b), b)).toBe(0);
+      fc.property(fc.array(objArb, { minLength: PAIRS, maxLength: PAIRS }), (bs) => {
+        expect(e1562(bs.map((b): [D, D] => [widen(b), b]))).toEqual(bs.map(() => 0));
       }),
-      { seed: SEED, numRuns: 6 },
+      { seed: SEED, numRuns: 1 },
     );
   },
   SLOW,
--- a/packages/cli/conformance/E1562-base-output-removed.test.ts
+++ b/packages/cli/conformance/E1562-base-output-removed.test.ts
@@ -1,48 +1,41 @@
 // Spec: k.compat, clause "Removing an `output` field a base entry requires is one E1562 with no fix; adding a field to an open output object is none."
-// Seed 1337. Cross-deployable caller `a` (deployable x) of entry `y.load` of the contract `y` (deployable y).
-import fc from "fast-check";
+// Seed 1337. Cross-deployable caller `a` (deployable x) of the contract `y` (deployable y). Every field is an entry `y.load<j>` of one project
+// (`projectMany`), so the case is three builds and two checks.
 import { afterAll, expect, test } from "vitest";
-import { SEED, baseSurface, buildAndCheck, cleanup, diags, project, write } from "./compat-support.ts";
+import { baseSurface, buildAndCheck, cleanup, e1562Of, projectMany, write } from "./compat-support.ts";
 
-/** Property runs spawn several `keel build` and `keel check` processes each. */
+/** The case spawns three `keel build` and two `keel check`. */
 const SLOW = 120_000;
 
 const dirs: string[] = [];
 afterAll(() => {
   for (const d of dirs) cleanup(d);
 });
-const field = fc.constantFrom("title", "total", "status");
+const FIELDS = ["title", "total", "status"];
 
 test(
   "Removing an `output` field a base entry requires is one E1562 with no fix; adding a field to an open output object is none.",
   () => {
-    fc.assert(
-      fc.property(field, (f) => {
-        const both = `s.object({ id: s.string(), ${f}: s.string() })`;
-        const onlyId = "s.object({ id: s.string() })";
-        const value = (withField: boolean): string => (withField ? `{ id: 'i', ${f}: 'v' }` : "{ id: 'i' }");
-        const { dir, base } = baseSurface(project({ output: both, outputValue: value(true), split: true }));
-        dirs.push(dir);
+    /** An output schema of `id` and `fields`, all strings, and a value of it. */
+    const output = (fields: readonly string[]): [string, string] => [
+      `s.object({ ${["id", ...fields].map((n) => `${n}: s.string()`).join(", ")} })`,
+      `{ ${["id", ...fields].map((n) => `${n}: '${n === "id" ? "i" : "v"}'`).join(", ")} }`,
+    ];
+    const { dir, base } = baseSurface(projectMany({ outputs: FIELDS.map((f) => output([f])) }));
+    dirs.push(dir);
 
-        write(dir, project({ output: onlyId, outputValue: value(false), split: true }));
-        const removed = diags(buildAndCheck(dir, base), "E1562");
-        expect(removed).toHaveLength(1);
-        expect(String(removed[0]?.message)).toContain(f);
-        expect(removed[0]?.fix).toBeUndefined();
+    write(dir, projectMany({ outputs: FIELDS.map(() => output([])) }));
+    const removed = buildAndCheck(dir, base);
+    FIELDS.forEach((f, j) => {
+      const found = e1562Of(removed, `y.load${j}`);
+      expect(found, f).toHaveLength(1);
+      expect(String(found[0]?.message)).toContain(f);
+      expect(found[0]?.fix).toBeUndefined();
+    });
 
-        const extra = `s.object({ id: s.string(), ${f}: s.string(), more: s.string() })`;
-        write(
-          dir,
-          project({
-            output: extra,
-            outputValue: `{ id: 'i', ${f}: 'v', more: 'm' }`,
-            split: true,
-          }),
-        );
-        expect(diags(buildAndCheck(dir, base), "E1562")).toEqual([]);
-      }),
-      { seed: SEED, numRuns: 3 },
-    );
+    write(dir, projectMany({ outputs: FIELDS.map((f) => output([f, "more"])) }));
+    const extra = buildAndCheck(dir, base);
+    FIELDS.forEach((f, j) => expect(e1562Of(extra, `y.load${j}`), f).toEqual([]));
   },
   SLOW,
 );
--- a/packages/cli/conformance/compat-0092.test.ts
+++ b/packages/cli/conformance/compat-0092.test.ts
@@ -10,6 +10,7 @@
 import {
   SEED,
   baseSurface,
+  baseSurfaceOnce,
   buildAndCheck,
   cleanup,
   diags,
@@ -55,7 +56,7 @@
     fc.assert(
       fc.property(fc.constantFrom("note", "qty", "label"), (f) => {
         const NAME = "s.object({ name: s.string() })";
-        const { dir, base } = baseSurface(project({ body: NAME, split: false }));
+        const { dir, base } = baseSurfaceOnce(project({ body: NAME, split: false }));
         dirs.push(dir);
         write(dir, project({ body: `s.object({ name: s.string(), ${f}: s.string() })`, split: false }));
         expect(keel(dir, ["build"]).status).toBe(0);
--- a/packages/cli/conformance/E1562-base-route-change.test.ts
+++ b/packages/cli/conformance/E1562-base-route-change.test.ts
@@ -5,7 +5,7 @@
 import { afterAll, expect, test } from "vitest";
 import {
   SEED,
-  baseSurface,
+  baseSurfaceOnce,
   buildAndCheck,
   cleanup,
   diags,
@@ -32,7 +32,7 @@
     fc.assert(
       fc.property(field, (f) => {
         const required = `s.object({ name: s.string(), ${f}: s.string()  }, { closed: true })`;
-        const { dir, base } = baseSurface(project({ body: NAME, split: true }));
+        const { dir, base } = baseSurfaceOnce(project({ body: NAME, split: true }));
         dirs.push(dir);
         write(dir, project({ body: required, split: true }));
         const run = buildAndCheck(dir, base);
@@ -49,7 +49,7 @@
         );
         expect(diags(buildAndCheck(dir, base), "E1562")).toEqual([]);
 
-        const one = baseSurface(project({ body: NAME, split: false }));
+        const one = baseSurfaceOnce(project({ body: NAME, split: false }));
         dirs.push(one.dir);
         write(one.dir, project({ body: required, split: false }));
         expect(diags(buildAndCheck(one.dir, one.base), "E1562")).toEqual([]);
@@ -61,14 +61,14 @@
 );
 
 test("E1562: modules in one deployable are not compared; moving `a` to another deployable makes the same change E1562", () => {
-  const { dir, base } = baseSurface(project({ body: NAME, split: false }));
+  const { dir, base } = baseSurfaceOnce(project({ body: NAME, split: false }));
   dirs.push(dir);
   write(dir, project({ body: "s.object({ name: s.string(), note: s.string()  }, { closed: true })", split: true }));
   expect(diags(buildAndCheck(dir, base), "E1562")).toHaveLength(1);
 });
 
 test("E1562: a change that no base endpoint refuses (an added optional field) is clean", () => {
-  const { dir, base } = baseSurface(project({ body: NAME, split: true }));
+  const { dir, base } = baseSurfaceOnce(project({ body: NAME, split: true }));
   dirs.push(dir);
   write(
     dir,
```
