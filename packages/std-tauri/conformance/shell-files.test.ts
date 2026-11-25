// Spec: std.tauri, clause "With `web` (`client`) declaring `tauri`, `keel build` writes the `deploy/web/tauri/` files and no Capacitor file; a changed byte is E1005 whose fix restores it; removing `tauri` from `topology.ts` removes them."
// Seed: 1337 (the file and the byte position of the tamper are generated).
// The real binary over a temp project (`keel-cli.ts`): `keel build` writes the shell files, `keel check` reads E1005 and its fix (a unified diff of the changed file).
// ASSUMPTION: `Cargo.lock` is never generated (std.tauri Files), so the generated set is exactly the six files listed.
import { chmodSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { cleanup, keel, materialize, readTree } from "./keel-cli.ts";
import { applyDiff } from "./unified-diff.ts";

const SEED = 1337;
const SLOW = 300_000;

const manifestSrc = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;
const topologySrc = (shell: boolean): string =>
  `import { topology } from '@keel/server'\nexport default topology({\n  web: { modules: ['c'], adapter: 'client'${shell ? ", shells: { tauri: { id: 'dev.keel.golden', name: 'Golden' } }" : ""} },\n})\n`;
const project = (shell: boolean): Map<string, string> =>
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
    ["topology.ts", topologySrc(shell)],
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

const TAURI_FILES = [
  "deploy/web/tauri/tauri.conf.json",
  "deploy/web/tauri/Cargo.toml",
  "deploy/web/tauri/build.rs",
  "deploy/web/tauri/src/main.rs",
  "deploy/web/tauri/src/lib.rs",
  "deploy/web/tauri/capabilities/default.json",
] as const;

let dir = "";
beforeAll(() => {
  dir = materialize(project(true));
}, SLOW);
afterAll(() => cleanup(dir));

const underTauri = (tree: Map<string, string>): string[] =>
  [...tree.keys()].filter((p) => p.startsWith("deploy/web/tauri/"));
const anyCapacitor = (tree: Map<string, string>): string[] =>
  [...tree.keys()].filter((p) => /capacitor/i.test(p) && !p.startsWith("node_modules/"));
const e1005 = (records: { kind: string; code?: unknown; path?: unknown; fix?: unknown }[], path: string) =>
  records.filter((r) => r.kind === "diag" && r.code === "E1005" && r.path === path);

describe("std.tauri: shell files", () => {
  test(
    "With `web` (`client`) declaring `tauri`, `keel build` writes the `deploy/web/tauri/` files and no Capacitor file; a changed byte is E1005 whose fix restores it; removing `tauri` from `topology.ts` removes them.",
    () => {
      expect(keel(dir, ["build"]).status).toBe(0);
      const built = readTree(dir);
      expect(underTauri(built).sort()).toEqual([...TAURI_FILES].sort());
      expect(anyCapacitor(built)).toEqual([]);
      expect(keel(dir, ["check"]).records.filter((r) => r["code"] === "E1005")).toEqual([]);

      fc.assert(
        fc.property(fc.constantFrom(...TAURI_FILES), fc.nat(), (rel, n) => {
          const original = built.get(rel) ?? "";
          const at = n % original.length;
          const tampered = `${original.slice(0, at)}${original[at] === "#" ? "%" : "#"}${original.slice(at + 1)}`;
          try {
            chmodSync(join(dir, rel), 0o644);
            writeFileSync(join(dir, rel), tampered);
            const found = e1005(keel(dir, ["check"]).records, rel);
            expect(found).toHaveLength(1);
            const fix = found[0]?.fix;
            expect(typeof fix).toBe("string");
            expect(applyDiff(tampered, { action: "change", path: rel, diff: String(fix) })).toBe(original);
          } finally {
            writeFileSync(join(dir, rel), original);
          }
        }),
        { seed: SEED, numRuns: 4 },
      );

      chmodSync(join(dir, "topology.ts"), 0o644);
      writeFileSync(join(dir, "topology.ts"), topologySrc(false));
      expect(keel(dir, ["build"]).status).toBe(0);
      expect(underTauri(readTree(dir))).toEqual([]);
      expect(anyCapacitor(readTree(dir))).toEqual([]);
    },
    SLOW,
  );
});
