// Seed 1337 (no generated input: one fixture, one spawned build). An app pays only for what it uses (k.schemes,
// k.themes, k.aria Print and Scheme): a one-scheme app with no `themes`, no break prop, no `media`, no `Box scheme`,
// no `SchemeSelect` or `ThemeSelect` builds to client assets no larger than the main line's build of the same app
// before themes, print props and subtree schemes existed, and its bundle holds no part of the token grammar or the
// colour maths, which run at check and build time only (k.values Stylesheet).
//
// FIGURE: the raw bytes of every file in `dist/web/assets` (the one script and the one stylesheet) of this fixture,
// built with `keel build` in a scratch worktree of `jdforsythe/test-impl` at 1fe7e49aa (`git worktree add` under
// $TMPDIR, `pnpm install --offline`, this file copied into packages/cli/test, run, the worktree removed): see BYTES.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, beforeAll, expect, test } from "vitest";
import { type Tree, cleanup, keel, materialize } from "../conformance/compat-support.ts";

const SLOW = fixedTime(300_000);
/** The main line's figure for this fixture (see FIGURE above). */
const BYTES = 85_376;

const tree: Tree = {
  "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0" })}\n`,
  "vite.config.ts":
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  "tsconfig.json": JSON.stringify({
    compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
  }),
  "tokens.ts": 'import { brandTokens } from "@keel/ui/brand";\n\nexport const tokens = brandTokens;\n',
  "topology.ts":
    "import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['w'], adapter: 'client' } })\n",
  "modules/w/module.ts":
    "import { module } from '@keel/compiler'\nexport default module({ id: 'w', deps: [], capabilities: [], public: { exports: [] } })\n",
  "modules/w/w.contract.ts":
    "import { contract } from '@keel/router/contract'\nexport const w = contract('w', { 'w.home': { path: '/' } })\n",
  "modules/w/Page.tsx":
    "import { Box, Heading, Text } from '@keel/ui'\nexport default function Page() {\n  return (\n" +
    '    <Box id="w.page" as="main" p="4" gap="2" direction="column">\n' +
    '      <Heading id="w.page.title" level={1}>Home</Heading>\n' +
    '      <Text id="w.page.text" fg="textSecondary">Static files only</Text>\n    </Box>\n  )\n}\n',
  "modules/w/routes.ts":
    "import { manifest } from '@keel/router'\nimport Page from './Page.tsx'\nimport { w } from './w.contract.ts'\n" +
    "export const routes = manifest(w, { 'w.home': { component: Page } })\n",
};

let dir = "";
beforeAll(() => {
  dir = materialize(tree);
}, SLOW);
afterAll(() => cleanup(dir));

/** Every built asset of deployable `web`, by name. */
function assets(): Map<string, Buffer> {
  const r = keel(dir, ["build"]);
  expect(r.status, JSON.stringify(r.records.filter((x) => x.kind === "diag"))).toBe(0);
  const at = join(dir, "dist", "web", "assets");
  return new Map(readdirSync(at).map((f) => [f, readFileSync(join(at, f))]));
}

test(
  "a one-scheme app with no themes and no print or subtree props builds no larger than before they existed, and ships no token grammar or colour maths",
  () => {
    const files = assets();
    const total = [...files.values()].reduce((n, b) => n + b.length, 0);
    expect(total).toBeLessThanOrEqual(BYTES);
    const code = [...files]
      .filter(([f]) => f.endsWith(".js"))
      .map(([, b]) => b.toString("utf8"))
      .join("\n");
    // The grammar (the value forms' words, as token-grammar-client-bundle.test.ts reads them, and TokenSchema's
    // message), the colour maths (the sRGB and WCAG transfer constants, the oklab matrix), the unused props' code.
    const absent = ["safe-area-inset", "cqmin", "revert-layer", "fails TokenSchema", "display-p3", "oklch"];
    // Constants without their leading `0`: a minifier prints `0.04045` as `.04045`.
    absent.push(".03928", ".04045", ".0031308", ".4122214694707629", "breakInside", "k-media-", "data-k-theme");
    for (const text of absent) expect(code.includes(text), text).toBe(false);
  },
  SLOW,
);
