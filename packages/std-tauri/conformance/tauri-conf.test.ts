// Spec: std.tauri, Conformance "`tauri.conf.json` holds the declared `identifier` and `productName`, the `package.json` `version`, and the deployable's policy with `ipc: http://ipc.localhost` in `connect-src`."
// Seed: 1337 (identifier, name and version are generated).
// The real binary over a temp project (`keel-cli.ts`): `keel build` writes `deploy/web/tauri/tauri.conf.json` and `dist/web/csp.txt`.
// ASSUMPTION: `app.security.csp` is the policy as one string, as `csp.txt` is; "the deployable's policy with ... added" is read as the same directive set as `csp.txt`, `connect-src` gaining the source `ipc: http://ipc.localhost`
// (written as one token `ipc:` followed by `http://ipc.localhost`, as the spec prints it). `app.windows[0].title` is not asserted here (std.tauri Files, not this clause).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { cleanup, keel, materialize } from "./keel-cli.ts";

const SEED = 1337;
const SLOW = 300_000;

const manifestSrc = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;
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
      "import { manifest } from '@keel/router'\nimport { c } from './c.contract.ts'\nimport Page from './Page.tsx'\nexport const routes = manifest(c, { 'c.page': { component: Page } })\n",
    ],
    [
      "modules/c/c.contract.ts",
      "import { contract } from '@keel/router/contract'\nexport const c = contract('c', { 'c.page': { path: '/' } })\n",
    ],
  ]);

const label = fc.stringMatching(/^[a-z][a-z0-9]{2,8}$/);
const identifier = fc.tuple(label, label, label).map(([a, b, c]) => `${a}.${b}.${c}`);
const productName = fc.stringMatching(/^[A-Z][a-z]{2,8}( [A-Z][a-z]{2,8})?$/);
const version = fc.tuple(fc.nat(20), fc.nat(20), fc.nat(20)).map(([a, b, c]) => `${a}.${b}.${c}`);

const field = (v: unknown, k: string): unknown => (typeof v === "object" && v !== null ? Reflect.get(v, k) : undefined);
const directives = (policy: string): string[] =>
  policy
    .split(";")
    .map((d) => d.trim())
    .filter((d) => d !== "");

describe("std.tauri: tauri.conf.json", () => {
  test(
    "`tauri.conf.json` holds the declared `identifier` and `productName`, the `package.json` `version`, and the deployable's policy with `ipc: http://ipc.localhost` in `connect-src`.",
    () => {
      fc.assert(
        fc.property(identifier, productName, version, (id, name, v) => {
          const dir = materialize(project(id, name, v));
          try {
            expect(keel(dir, ["build"]).status).toBe(0);
            const conf: unknown = JSON.parse(readFileSync(join(dir, "deploy/web/tauri/tauri.conf.json"), "utf8"));
            expect(field(conf, "identifier")).toBe(id);
            expect(field(conf, "productName")).toBe(name);
            expect(field(conf, "version")).toBe(v);

            const csp = field(field(field(conf, "app"), "security"), "csp");
            expect(typeof csp).toBe("string");
            const policy = directives(readFileSync(join(dir, "dist/web/csp.txt"), "utf8"));
            const tauri = directives(String(csp));
            const connect = tauri.find((d) => d.startsWith("connect-src ")) ?? "";
            expect(connect).toContain("ipc: http://ipc.localhost");
            const without = (d: string): string => d.replace(" ipc: http://ipc.localhost", "");
            expect(tauri.map(without).sort()).toEqual(policy.sort());
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
