// Spec: k.return, clause "The shell files register `id` as a scheme: an Android intent filter, iOS `CFBundleURLTypes`, Tauri's deep-link schemes."
// Seed: 1337 (the reverse-DNS `id` is generated). This file is the Tauri part (the generated `tauri.conf.json`); the Android part is packages/cli/conformance/return-scheme-android.test.ts.
// UNTESTABLE blind: iOS `CFBundleURLTypes`. The `Info.plist` belongs to the platform project `cap add ios` writes, and the spec does not say how the build finds Xcode 26, so no fake toolchain can be written from the spec.
// ASSUMPTION: Tauri's deep-link schemes are `plugins["deep-link"].desktop.schemes` of `tauri.conf.json`, an array holding the `id` as it is (no `:`), as RFC 0142 D3 names the key.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { cleanup, keel, materialize } from "./keel-cli.ts";

const SEED = 1337;
const SLOW = 300_000;

const manifestSrc = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [], routes: [] } })\n`;
const project = (id: string, name: string, version: string): Map<string, string> =>
  new Map([
    [
      "package.json",
      `${JSON.stringify({ name: "fx", private: true, type: "module", version, dependencies: { "@keel/std-tauri": "workspace:*" } })}\n`,
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
      "import { manifest } from '@keel/router'\nimport Page from './Page.tsx'\nexport const routes = manifest({ 'c.page': { path: '/', component: Page } })\n",
    ],
  ]);

const label = fc.stringMatching(/^[a-z][a-z0-9]{2,8}$/);
const identifier = fc.tuple(label, label, label).map(([a, b, c]) => `${a}.${b}.${c}`);

const field = (v: unknown, k: string): unknown => (typeof v === "object" && v !== null ? Reflect.get(v, k) : undefined);

describe("k.return: the shell files register id as a scheme (Tauri)", () => {
  test(
    "the generated `tauri.conf.json` lists the declared `id` in the deep-link plugin's desktop schemes",
    () => {
      fc.assert(
        fc.property(identifier, (id) => {
          const dir = materialize(project(id, "Golden", "1.0.0"));
          try {
            expect(keel(dir, ["build"]).status).toBe(0);
            const conf: unknown = JSON.parse(readFileSync(join(dir, "deploy/web/tauri/tauri.conf.json"), "utf8"));
            const schemes = field(field(field(field(conf, "plugins"), "deep-link"), "desktop"), "schemes");
            expect(schemes).toEqual([id]);
          } finally {
            cleanup(dir);
          }
        }),
        { seed: SEED, numRuns: 3 },
      );
    },
    SLOW,
  );
});
