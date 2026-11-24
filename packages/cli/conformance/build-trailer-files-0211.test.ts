// Spec: k.deploy Build, "Its summary's `files` counts the root project's app sources, the files its `.keel/` artifacts derive from: each code file (k.check Trailer) outside a nested project root (k.topology Rules) that is not a test (`*.test.*`, `*.spec.*`), a declaration (`*.d.ts`, `*.d.mts`, `*.d.cts`) or a tool config (`*.config.*`), and has no path segment that starts with `.` or is `node_modules`, `dist`, `coverage`, `reports`, `test`, `tests` or `conformance`."
// Spec: k.deploy Conformance 13, "In a project whose files besides `package.json` and those `keel build` writes are `topology.ts`, `vite.config.ts`, `modules/a/module.ts`, `modules/a/A.tsx`, `modules/a/A.test.tsx` and `test/a.test.ts`, a second `keel build`'s json summary has `counts.files` 3; with a nested project `apps/b/` added (its own `package.json`, `topology.ts`, `modules/b/module.ts` and `modules/b/B.tsx`, and the files its `keel build` wrote), `keel build` at the root still counts 3."
// Seed 1337 (the property adds generated code files: some are app sources and raise the count, others are tests, declarations, tool configs or sit under a skipped, dot or nested-project folder and do not).
// Real binary over a temp project with `@keel/*` and `vite` linked. The spec's trailer text describes what the code already does: the example cases may pass before the RFC's build.
// The 3 are `topology.ts`, `modules/a/module.ts` and `modules/a/A.tsx`: `vite.config.ts` is a tool config, the two tests are tests.
// Ambiguity: `apps/b/` has no `vite.config.ts` in the spec's file list, so its own build may fail; the case does not assert that build's exit status.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { SEED, cleanup, keel, materialize, type Tree } from "./compat-support.ts";

const SLOW = 600_000;

const manifestSrc = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;
const base = (): Tree => ({
  "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0" })}\n`,
  "vite.config.ts":
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  "topology.ts":
    "import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['a'], adapter: 'client' } })\n",
  "modules/a/module.ts": manifestSrc("a"),
  "modules/a/A.tsx": "export default function A() {\n  return null\n}\n",
  "modules/a/A.test.tsx": "export const aTest = 1\n",
  "test/a.test.ts": "export const aTestFile = 1\n",
});
const nested = (): Tree => ({
  "apps/b/package.json": `${JSON.stringify({ name: "b", private: true, type: "module", version: "1.0.0" })}\n`,
  "apps/b/topology.ts":
    "import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['b'], adapter: 'client' } })\n",
  "apps/b/modules/b/module.ts": manifestSrc("b"),
  "apps/b/modules/b/B.tsx": "export default function B() {\n  return null\n}\n",
});

/** The final `summary` record's `counts.files`. */
function files(dir: string, args: string[]): number | undefined {
  const summary = keel(dir, args)
    .records.filter((r) => r.kind === "summary")
    .at(-1);
  const counts = summary?.counts;
  const n = typeof counts === "object" && counts !== null ? Reflect.get(counts, "files") : undefined;
  return typeof n === "number" ? n : undefined;
}

let dir = "";
beforeAll(() => {
  dir = materialize(base());
}, SLOW);
afterAll(() => cleanup(dir));

/** A file whose name matches its single export, so the build's check gate (E1752) stays clean. */
const exporting = (rel: string): string => `export const ${(rel.split("/").pop() ?? "").split(".")[0]} = 1\n`;
const put = (rel: string, text: string): void => {
  const full = join(dir, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text);
};

describe("k.deploy Build: what `files` counts (rfc:0211)", () => {
  test(
    "in a project of `topology.ts`, `vite.config.ts`, `modules/a/module.ts`, `modules/a/A.tsx`, `modules/a/A.test.tsx` and `test/a.test.ts`, a second `keel build`'s json summary has `counts.files` 3",
    () => {
      keel(dir, ["build"]);
      expect(files(dir, ["build"])).toBe(3);
    },
    SLOW,
  );

  test(
    "with a nested project `apps/b/` added, `keel build` at the root still counts 3",
    () => {
      try {
        for (const [rel, text] of Object.entries(nested())) put(rel, text);
        keel(join(dir, "apps/b"), ["build"]);
        expect(files(dir, ["build"])).toBe(3);
      } finally {
        rmSync(join(dir, "apps"), { recursive: true, force: true });
      }
    },
    SLOW,
  );

  test(
    "`files` counts each code file that is not a test, a declaration or a tool config, outside a nested project, with no `.`-led, `node_modules`, `dist`, `coverage`, `reports`, `test`, `tests` or `conformance` path segment",
    () => {
      const ext = fc.constantFrom("ts", "tsx", "mts", "cts", "js", "jsx", "mjs");
      const source = ext.chain((e) =>
        fc.constantFrom(
          (n: number) => `modules/a/extra${n}.${e}`,
          (n: number) => `lib/extra${n}.${e}`,
        ),
      );
      const skipped = fc.oneof(
        ext.map((e) => (n: number) => `modules/a/extra${n}.test.${e}`),
        ext.map((e) => (n: number) => `modules/a/extra${n}.spec.${e}`),
        ext.map((e) => (n: number) => `tools/extra${n}.config.${e}`),
        fc.constantFrom("d.ts", "d.mts", "d.cts").map((e) => (n: number) => `types/extra${n}.${e}`),
        fc
          .constantFrom(".hidden", "node_modules/pkg", "dist", "coverage", "reports", "test", "tests", "conformance")
          .map((seg) => (n: number) => `modules/a/${seg}/extra${n}.ts`),
        fc.constantFrom((n: number) => `apps/b/modules/b/extra${n}.ts`),
      );
      keel(dir, ["build"]);
      fc.assert(
        fc.property(
          fc.array(source, { maxLength: 3 }),
          fc.array(skipped, { maxLength: 3 }),
          (sourceNames, skippedNames) => {
            const written: string[] = [];
            try {
              for (const [rel, text] of Object.entries(nested())) put(rel, text);
              sourceNames.forEach((f, i) => {
                const rel = f(i);
                put(rel, exporting(rel));
                written.push(rel);
              });
              skippedNames.forEach((f, i) => {
                const rel = f(100 + i);
                put(rel, exporting(rel));
                written.push(rel);
              });
              expect(files(dir, ["build"])).toBe(3 + sourceNames.length);
            } finally {
              for (const rel of written) rmSync(join(dir, rel), { force: true });
              rmSync(join(dir, "apps"), { recursive: true, force: true });
            }
          },
        ),
        { seed: SEED, numRuns: 3 },
      );
    },
    SLOW,
  );
});
