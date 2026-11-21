// Spec: std.capacitor, Conformance "The generated workflow of a project declaring `capacitor` has a `web-android` job and a `web-ios` job that runs on `workflow_dispatch` only."
// Spec: std.capacitor, CI "Two `ShellJob`s: `android` on `ubuntu-24.04` with JDK 21, uploading the debug APK; `ios` on `macos-15` with Xcode 26, `manual`."
// Seed: 1337 (the id and name are generated).
// The real binary over a temp project (`keel-cli.ts`): `keel build` writes `.github/workflows/ci.yml`.
// ASSUMPTION: a job is a two-space-indented key under `jobs:`; "runs on `workflow_dispatch` only" is the `web-ios` block naming `workflow_dispatch` (its gate) and the `web-android` block not naming it;
// the spec does not give the YAML of a gate, nor how JDK 21, Xcode 26 or the upload are written, so those are asserted as the block mentioning `21`, `26` and `upload-artifact`.
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
      `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.2.3", dependencies: { "@keel/std-capacitor": "workspace:*" } })}\n`,
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
      `import { topology } from '@keel/server'\nexport default topology({\n  web: { modules: ['c'], adapter: 'client', shells: { capacitor: { id: '${id}', name: '${name}' } } },\n})\n`,
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

const workflow = (id: string, name: string, then: (yml: string) => void): void => {
  const dir = materialize(project(id, name));
  try {
    expect(keel(dir, ["build"]).status).toBe(0);
    then(readFileSync(join(dir, ".github/workflows/ci.yml"), "utf8"));
  } finally {
    cleanup(dir);
  }
};

describe("std.capacitor: CI", () => {
  test(
    "The generated workflow of a project declaring `capacitor` has a `web-android` job and a `web-ios` job that runs on `workflow_dispatch` only.",
    () => {
      fc.assert(
        fc.property(identifier, productName, (id, name) => {
          workflow(id, name, (yml) => {
            const android = jobBlock(yml, "web-android");
            const ios = jobBlock(yml, "web-ios");
            expect(android).not.toBe("");
            expect(ios).not.toBe("");
            expect(ios).toContain("workflow_dispatch");
            expect(android).not.toContain("workflow_dispatch");
            expect(android).toContain("keel build --target capacitor --platform android");
            expect(ios).toContain("keel build --target capacitor --platform ios");
          });
        }),
        { seed: SEED, numRuns: 2 },
      );
    },
    SLOW,
  );

  test(
    "`android` runs on `ubuntu-24.04` with JDK 21 and uploads the debug APK; `ios` runs on `macos-15` with Xcode 26.",
    () => {
      fc.assert(
        fc.property(identifier, productName, (id, name) => {
          workflow(id, name, (yml) => {
            const android = jobBlock(yml, "web-android");
            const ios = jobBlock(yml, "web-ios");
            expect(android).toContain("runs-on: ubuntu-24.04");
            expect(android).toContain("21");
            expect(android).toContain("upload-artifact");
            expect(android).toContain("app-debug.apk");
            expect(ios).toContain("runs-on: macos-15");
            expect(ios).toContain("26");
          });
        }),
        { seed: SEED, numRuns: 2 },
      );
    },
    SLOW,
  );
});
