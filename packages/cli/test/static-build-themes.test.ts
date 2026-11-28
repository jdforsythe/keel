// Seed 1337 (no generated input: one fixture, one spawned build). `keel build` of a `static` deployable whose tokens
// have a `choice` theme (k.hosting Static, k.schemes First paint): the prerendered document's `ThemeSelect` lists
// `default` and the theme, as the first client render does, and the build leaves no artifacts in `dist/site/`.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, beforeAll, expect, test } from "vitest";
import { type Tree, cleanup, keel, materialize } from "../conformance/compat-support.ts";

const SLOW = fixedTime(300_000);

const tree: Tree = {
  "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0" })}\n`,
  "vite.config.ts":
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  "tsconfig.json": JSON.stringify({
    compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
  }),
  "topology.ts":
    "import { topology } from '@keel/server'\nexport default topology({ site: { modules: ['s'], adapter: 'static' } })\n",
  "tokens.ts":
    "import { brandTokens } from '@keel/ui/brand'\nimport { defineTokens } from '@keel/ui/tokens'\n" +
    "export const tokens = defineTokens({ ...brandTokens, themes: { slate: { color: { surface: '#F4F7FB' } } } })\n",
  "modules/s/module.ts":
    "import { module } from '@keel/compiler'\nexport default module({ id: 's', deps: [], capabilities: [], public: { exports: [] } })\n",
  "modules/s/s.contract.ts":
    "import { contract } from '@keel/router/contract'\nexport const s = contract('s', { 's.home': { path: '/' } })\n",
  "modules/s/Page.tsx":
    "import { Box, ThemeSelect } from '@keel/ui'\nexport default function Page() {\n  return (\n" +
    '    <Box id="s.page">\n      <ThemeSelect id="s.page.theme" label="Theme" labels={{ default: "Keel", slate: "Slate" }} />\n    </Box>\n  )\n}\n',
  "modules/s/routes.ts":
    "import { manifest } from '@keel/router'\nimport Page from './Page.tsx'\nimport { s } from './s.contract.ts'\nexport const routes = manifest(s, { 's.home': { component: Page } })\n",
};

let dir = "";
beforeAll(() => {
  dir = materialize(tree);
}, SLOW);
afterAll(() => cleanup(dir));

test(
  "the prerendered ThemeSelect lists default and the choice theme, and dist/site/ holds no server artifact",
  () => {
    const r = keel(dir, ["build"]);
    expect(r.status).toBe(0);
    const home = readFileSync(join(dir, "dist", "site", "index.html"), "utf8");
    const options = [...home.matchAll(/<option\b[^>]*\bvalue="([^"]+)"/g)].map((m) => m[1]);
    expect(options).toEqual(["default", "slate"]);
    for (const f of ["schemes.json", "routes.json", "std.json"])
      expect(existsSync(join(dir, "dist", "site", f))).toBe(false);
  },
  SLOW,
);
