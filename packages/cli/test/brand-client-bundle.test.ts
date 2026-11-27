// Seed 1337 (no generated input: one fixture, two spawned builds). k.ui Tokens: `@keel/ui/tokens` runs at check and
// build time only, and `brandTokens` (`@keel/ui/brand`) is plain data a component may read. So a page that reads a
// brand value ships the value and none of the grammar or the colour maths, even when `tokens.ts` calls
// `defineTokens`. The control builds the same app with a page that calls `defineTokens`, so each string the first case
// finds absent is shown present when that code is bundled, through the same `keel build` and its minifier.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, beforeAll, expect, test } from "vitest";
import { type Tree, cleanup, keel, materialize } from "../conformance/compat-support.ts";

const SLOW = fixedTime(300_000);
/** Strings only `@keel/ui/tokens` holds: TokenSchema's message, a value form's word, digits of the Oklab matrix. */
const TOKENS_CODE = ["fail TokenSchema", "safe-area-inset", "revert-layer", "2104542553"];
const ACCENT = "#b8420d";

const page = (body: string): string =>
  `import { Box, Text } from '@keel/ui'\nimport { brandTokens } from '@keel/ui/brand'\n${body}export default function Page() {\n  return (\n    <Box id="w.page" as="main" p="4">\n      <Text id="w.page.text">{label()}</Text>\n    </Box>\n  )\n}\n`;
const READS = page("const label = (): string => brandTokens.color.accent\n");
const VALIDATES = page(
  "import { defineTokens } from '@keel/ui/tokens'\n" +
    "const label = (): string => defineTokens({ ...brandTokens }).color.accent\n",
);

const tree = (pageSource: string): Tree => ({
  "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0" })}\n`,
  "vite.config.ts":
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  "tsconfig.json": JSON.stringify({
    compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
  }),
  "tokens.ts":
    'import { brandTokens } from "@keel/ui/brand";\nimport { defineTokens } from "@keel/ui/tokens";\n\nexport const tokens = defineTokens({ ...brandTokens });\n',
  "topology.ts":
    "import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['w'], adapter: 'client' } })\n",
  "modules/w/module.ts":
    "import { module } from '@keel/compiler'\nexport default module({ id: 'w', deps: [], capabilities: [], public: { exports: [] } })\n",
  "modules/w/w.contract.ts":
    "import { contract } from '@keel/router/contract'\nexport const w = contract('w', { 'w.home': { path: '/' } })\n",
  "modules/w/Page.tsx": pageSource,
  "modules/w/routes.ts":
    "import { manifest } from '@keel/router'\nimport Page from './Page.tsx'\nimport { w } from './w.contract.ts'\n" +
    "export const routes = manifest(w, { 'w.home': { component: Page } })\n",
});

const dirs: string[] = [];
beforeAll(() => {
  dirs.push(materialize(tree(READS)), materialize(tree(VALIDATES)));
}, SLOW);
afterAll(() => {
  for (const d of dirs) cleanup(d);
});

/** The client JavaScript `keel build` writes for the fixture at `dir`. */
function clientJs(dir: string): string {
  const r = keel(dir, ["build"]);
  expect(r.status, JSON.stringify(r.records.filter((x) => x.kind === "diag"))).toBe(0);
  const at = join(dir, "dist", "web", "assets");
  const js = readdirSync(at)
    .filter((f) => f.endsWith(".js"))
    .map((f) => readFileSync(join(at, f), "utf8"))
    .join("\n");
  expect(js.length).toBeGreaterThan(0);
  return js;
}

test(
  "a page that reads `brandTokens` ships the brand value and no code of `@keel/ui/tokens`, with `defineTokens` in `tokens.ts`",
  () => {
    const js = clientJs(dirs[0] ?? "");
    expect(js.toLowerCase()).toContain(ACCENT);
    for (const text of TOKENS_CODE) expect(js.includes(text), text).toBe(false);
  },
  SLOW,
);

test(
  "control: a page that calls `defineTokens` ships every one of those strings",
  () => {
    const js = clientJs(dirs[1] ?? "");
    for (const text of TOKENS_CODE) expect(js.includes(text), text).toBe(true);
  },
  SLOW,
);
