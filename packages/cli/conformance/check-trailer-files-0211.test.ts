// Spec: k.check Trailer, "The summary's `files` counts every file `keel check` checked: each code file (`*.ts`, `*.tsx`, `*.mts`, `*.cts`, `*.js`, `*.jsx`, `*.mjs`) and `.keel/*.json` artifact under `paths`, in every project there, tests and declarations among them and tool configs other than `vite.config.*`, `vitest.config.*` and `stryker.config.*` (those three are not read: the project's own `tsc` checks them). `keel build` counts its own (k.deploy Build)."
// Spec: k.check Conformance 14, "In a project `keel build` ran in, whose files besides `package.json` and those `keel build` wrote are `topology.ts`, `vite.config.ts`, `modules/a/module.ts`, `modules/a/A.tsx`, `modules/a/A.test.tsx` and `test/a.test.ts`, the json summary's `counts.files` is 5 plus the number of `.keel/*.json` files for `keel check`, and 3 for `keel check modules/a`; with a nested project `apps/b/` added (its own `package.json`, `topology.ts`, `modules/b/module.ts` and `modules/b/B.tsx`, and the files its `keel build` wrote), `keel check` at the root counts 8 plus the number of `.keel/*.json` files under the root, `apps/b/` included."
// Seed 1337 (the property adds generated code files of every counted extension, declarations, tests and tool configs, and non-code files that are not counted).
// Real binary over a temp project with `@keel/*` and `vite` linked; `keel build` runs first (at the root, and in `apps/b/` for the nested case) so the `.keel/*.json` artifacts exist; their number is read from disk.
// The spec's trailer text describes what the code already does: the example cases may pass before the RFC's build.
// Ambiguity: `apps/b/` has no `vite.config.ts` in the spec's file list, so its build may fail; the case does not assert that build's exit status, only the count over whatever `.keel/*.json` files exist.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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

/** `.keel/*.json` files directly in a `.keel` folder anywhere under `root`, `node_modules` excluded. */
function artifacts(root: string): number {
  let n = 0;
  const walk = (d: string, inKeel: boolean): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === "node_modules") continue;
      if (e.isDirectory()) walk(join(d, e.name), e.name === ".keel");
      else if (inKeel && e.name.endsWith(".json")) n++;
    }
  };
  walk(root, false);
  return n;
}

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
  keel(dir, ["build"]);
}, SLOW);
afterAll(() => cleanup(dir));

/** A file whose name matches its single export, so the build's check gate (E1752) stays clean. */
const exporting = (rel: string): string => `export const ${(rel.split("/").pop() ?? "").split(".")[0]} = 1\n`;
const put = (rel: string, text: string): void => {
  const full = join(dir, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text);
};

describe("k.check Trailer: what `files` counts (rfc:0211)", () => {
  test(
    "in a project `keel build` ran in, the json summary's `counts.files` is 5 plus the number of `.keel/*.json` files for `keel check`, and 3 for `keel check modules/a`",
    () => {
      const keelJson = artifacts(dir);
      expect(keelJson).toBeGreaterThan(0);
      expect(files(dir, ["check"])).toBe(5 + keelJson);
      expect(files(dir, ["check", "modules/a"])).toBe(3);
    },
    SLOW,
  );

  test(
    "with a nested project `apps/b/` added, `keel check` at the root counts 8 plus the number of `.keel/*.json` files under the root, `apps/b/` included",
    () => {
      try {
        for (const [rel, text] of Object.entries(nested())) put(rel, text);
        keel(join(dir, "apps/b"), ["build"]);
        expect(files(dir, ["check"])).toBe(8 + artifacts(dir));
      } finally {
        rmSync(join(dir, "apps"), { recursive: true, force: true });
      }
    },
    SLOW,
  );

  test(
    "`files` counts each code file (`*.ts`, `*.tsx`, `*.mts`, `*.cts`, `*.js`, `*.jsx`, `*.mjs`), tests and declarations among them, tool configs other than `vite.config.*`, `vitest.config.*` and `stryker.config.*`, and no other file",
    () => {
      const keelJson = artifacts(dir);
      const ext = fc.constantFrom("ts", "tsx", "mts", "cts", "js", "jsx", "mjs");
      const counted = fc.oneof(
        ext.map((e) => (n: number) => `modules/a/extra${n}.${e}`),
        ext.map((e) => (n: number) => `modules/a/extra${n}.test.${e}`),
        fc.tuple(fc.constantFrom("tailwind", "eslint", "tsup", "postcss", "vitepress"), ext).map(
          ([name, e]) =>
            (n: number) =>
              `tools/${name}${n}.config.${e}`,
        ),
        fc.constantFrom("d.ts", "d.mts", "d.cts").map((e) => (n: number) => `types/extra${n}.${e}`),
      );
      const toolExt = fc.constantFrom("ts", "mts", "cts", "js", "mjs", "cjs");
      const ignored = fc.oneof(
        fc.tuple(fc.constantFrom("vite", "vitest", "stryker"), toolExt).map(
          ([name, e]) =>
            (n: number) =>
              `tools/t${n}/${name}.config.${e}`,
        ),
        fc.constantFrom(
          (n: number) => `docs/note${n}.md`,
          (n: number) => `data${n}.txt`,
          (n: number) => `data/extra${n}.json`,
          (n: number) => `modules/a/style${n}.css`,
        ),
      );
      fc.assert(
        fc.property(
          fc.array(counted, { maxLength: 4 }),
          fc.array(ignored, { maxLength: 3 }),
          (countedNames, ignoredNames) => {
            const written: string[] = [];
            try {
              countedNames.forEach((f, i) => {
                const rel = f(i);
                put(rel, exporting(rel));
                written.push(rel);
              });
              ignoredNames.forEach((f, i) => {
                const rel = f(100 + i);
                put(rel, "x\n");
                written.push(rel);
              });
              expect(files(dir, ["check"])).toBe(5 + keelJson + countedNames.length);
            } finally {
              for (const rel of written) rmSync(join(dir, rel), { force: true });
            }
          },
        ),
        { seed: SEED, numRuns: 8 },
      );
    },
    SLOW,
  );
});
