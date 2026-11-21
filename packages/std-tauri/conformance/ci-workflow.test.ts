// Spec: std.tauri, Conformance "The generated workflow of a project declaring `tauri` has a `web-tauri` job on `ubuntu-24.04` that installs `libwebkit2gtk-4.1-dev` and runs `keel build --target tauri`."
// Seed: 1337 (the id and name are generated).
// The real binary over a temp project (`keel-cli.ts`): `keel build` writes `.github/workflows/ci.yml`.
// ASSUMPTION: a job is a two-space-indented key under `jobs:`; "on `ubuntu-24.04`" is `runs-on: ubuntu-24.04` in its block.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { cleanup, keel, materialize } from "./keel-cli.ts";

const SEED = 1337;
const SLOW = 300_000;

const manifestSrc = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;
const project = (id: string, name: string): Map<string, string> =>
  new Map([
    [
      "package.json",
      `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.2.3", dependencies: { "@keel/std-tauri": "workspace:*" } })}\n`,
    ],
    [
      "vite.config.ts",
      'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
    ],
    [
      "tsconfig.json",
      JSON.stringify({
        compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
      }),
    ],
    [
      "topology.ts",
      `import { topology } from '@keel/server'\nexport default topology({\n  web: { modules: ['c'], adapter: 'client', shells: { tauri: { id: '${id}', name: '${name}' } } },\n})\n`,
    ],
    ["modules/c/module.ts", manifestSrc("c")],
    [
      "modules/c/Page.tsx",
      'import { Box, Text } from "@keel/ui";\nexport default function Page() {\n  return (\n    <Box as="main">\n      <Text>Page</Text>\n    </Box>\n  );\n}\n',
    ],
    [
      "modules/c/routes.ts",
      "import { manifest } from '@keel/router'\nimport { c } from './c.contract.ts'\nimport Page from './Page.tsx'\nexport const routes = manifest(c, { 'c.page': { component: Page } })\n",
    ],
    [
      "modules/c/c.contract.ts",
      "import { contract } from '@keel/router/contract'\nexport const c = contract('c', { 'c.page': { path: '/' } })\n",
    ],
  ]);

const label = fc.stringMatching(/^[a-z][a-z0-9]{2,8}$/);
const identifier = fc.tuple(label, label, label).map(([a, b, c]) => `${a}.${b}.${c}`);
const productName = fc.stringMatching(/^[A-Z][a-z]{2,8}$/);

/** The text of the job `name` of `ci.yml`: from its key to the next key at the same indent. */
const jobBlock = (yml: string, name: string): string => {
  const lines = yml.split("\n");
  const at = lines.findIndex((l) => l === `  ${name}:`);
  if (at < 0) return "";
  const end = lines.findIndex((l, i) => i > at && /^ {2}[^\s#]/.test(l));
  return lines.slice(at, end < 0 ? undefined : end).join("\n");
};

describe("std.tauri: CI", () => {
  test(
    "The generated workflow of a project declaring `tauri` has a `web-tauri` job on `ubuntu-24.04` that installs `libwebkit2gtk-4.1-dev` and runs `keel build --target tauri`.",
    () => {
      fc.assert(
        fc.property(identifier, productName, (id, name) => {
          const dir = materialize(project(id, name));
          try {
            expect(keel(dir, ["build"]).status).toBe(0);
            const job = jobBlock(readFileSync(join(dir, ".github/workflows/ci.yml"), "utf8"), "web-tauri");
            expect(job).not.toBe("");
            expect(job).toContain("runs-on: ubuntu-24.04");
            expect(job).toContain("libwebkit2gtk-4.1-dev");
            expect(job).toContain("keel build --target tauri");
          } finally {
            cleanup(dir);
          }
        }),
        { seed: SEED, numRuns: 2 },
      );
    },
    SLOW,
  );
});
