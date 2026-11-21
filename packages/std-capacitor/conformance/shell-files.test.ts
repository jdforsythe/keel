// Spec: std.capacitor, Conformance "With `web` declaring `capacitor`, `keel build` writes `deploy/web/capacitor/capacitor.config.json` with `appId`, `appName` and `webDir` `www`, and no Tauri file."
// Seed: 1337 (the id and name are generated).
// The real binary over a temp project (`keel-cli.ts`): `keel build` writes the shell files.
// ASSUMPTION: "no Tauri file" is no path outside `node_modules/` whose name has `tauri` in it; the generated set under `deploy/web/capacitor/` is exactly `capacitor.config.json` (std.capacitor Files names no other).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { cleanup, keel, materialize, readTree } from "./keel-cli.ts";

const SEED = 1337;
const SLOW = 300_000;

const manifestSrc = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [], routes: [] } })\n`;
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
      "import { manifest } from '@keel/router'\nimport Page from './Page.tsx'\nexport const routes = manifest({ 'c.page': { path: '/', component: Page } })\n",
    ],
  ]);

const label = fc.stringMatching(/^[a-z][a-z0-9]{2,8}$/);
const identifier = fc.tuple(label, label, label).map(([a, b, c]) => `${a}.${b}.${c}`);
const productName = fc.stringMatching(/^[A-Z][a-z]{2,8}( [A-Z][a-z]{2,8})?$/);

const field = (v: unknown, k: string): unknown => (typeof v === "object" && v !== null ? Reflect.get(v, k) : undefined);

describe("std.capacitor: shell files", () => {
  test(
    "With `web` declaring `capacitor`, `keel build` writes `deploy/web/capacitor/capacitor.config.json` with `appId`, `appName` and `webDir` `www`, and no Tauri file.",
    () => {
      fc.assert(
        fc.property(identifier, productName, (id, name) => {
          const dir = materialize(project(id, name));
          try {
            expect(keel(dir, ["build"]).status).toBe(0);
            const tree = readTree(dir);
            expect([...tree.keys()].filter((p) => p.startsWith("deploy/web/capacitor/"))).toEqual([
              "deploy/web/capacitor/capacitor.config.json",
            ]);
            const conf: unknown = JSON.parse(
              readFileSync(join(dir, "deploy/web/capacitor/capacitor.config.json"), "utf8"),
            );
            expect(field(conf, "appId")).toBe(id);
            expect(field(conf, "appName")).toBe(name);
            expect(field(conf, "webDir")).toBe("www");
            expect([...tree.keys()].filter((p) => /tauri/i.test(p) && !p.startsWith("node_modules/"))).toEqual([]);
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
