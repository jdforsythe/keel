// k.library In an app: the rules that take their file set from somewhere other than the files themselves (the client
// reach behind E1004 and E1759, the type pass's roots and resolution, the artifacts the compile hands rules) hold a
// library's file as they hold an app module's file.
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterAll, expect, it } from "vitest";
import { check } from "../src/index.ts";

const LIB = "node_modules/@acme/charts";
const manifest = (id: string, deps: string[]) =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${JSON.stringify(deps).replaceAll('"', "'")}, capabilities: [], public: { exports: ['Badge'] } })\n`;
const pkg = JSON.stringify({
  name: "@acme/charts",
  version: "1.0.0",
  type: "module",
  keel: "library",
  exports: { ".": { keel: "./src/index.ts", default: "./index.js" } },
});
const TOPOLOGY =
  "import { topology } from '@keel/server'\nexport default topology({ site: { modules: ['shop'], adapter: 'static' } })\n";
const app = [
  { path: "topology.ts", source: TOPOLOGY },
  { path: "modules/shop/module.ts", source: manifest("shop", ["@acme/charts"]) },
  {
    path: "modules/shop/shop.contract.ts",
    source:
      "import { contract } from '@keel/router/contract'\nexport const shop = contract('shop', { 'shop.home': { path: '/' } })\n",
  },
  {
    path: "modules/shop/routes.ts",
    source:
      "import { manifest } from '@keel/router'\nimport Home from './Home.tsx'\nimport { shop } from './shop.contract.ts'\nexport const routes = manifest(shop, { 'shop.home': { component: Home } })\n",
  },
  {
    path: "modules/shop/Home.tsx",
    source:
      "import { Badge } from '@acme/charts'\nexport default function Home() {\n  return <Badge id=\"shop.badge\" />\n}\n",
  },
  { path: `${LIB}/package.json`, source: pkg },
  { path: `${LIB}/module.ts`, source: manifest("charts", []) },
  { path: `${LIB}/src/index.ts`, source: "export { default as Badge } from './Badge.tsx'\n" },
];
const badge = (head: string) =>
  `${head}import { Box } from '@keel/ui'\nexport default function Badge(props: { id: string }) {\n  return <Box id={\`\${props.id}.box\`} />\n}\n`;
const at = (code: string, files: { path: string; source: string }[], opts: Parameters<typeof check>[1] = {}) =>
  check([...app, ...files], { types: false, ...opts })
    .diagnostics.filter((d) => d.code === code)
    .map((d) => d.path);

it("E1759: a Node built-in a page reaches through a library is reported in the library's file, and not when no page reaches it", () => {
  const files = [
    { path: `${LIB}/src/Badge.tsx`, source: badge("import { readFileSync } from 'node:fs'\nvoid readFileSync\n") },
  ];
  expect(at("E1759", files)).toEqual([`${LIB}/src/Badge.tsx`]);
  const unreached = [
    ...files,
    { path: `${LIB}/src/Other.ts`, source: "import { readFileSync } from 'node:fs'\nexport const o = readFileSync\n" },
  ];
  expect(at("E1759", unreached)).toEqual([`${LIB}/src/Badge.tsx`]);
});

it("E1004: a server-only file a page reaches through a library is reported at the library's import", () => {
  const files = [
    { path: `${LIB}/src/Badge.tsx`, source: badge("import { secret } from './keys.server.ts'\nvoid secret\n") },
    { path: `${LIB}/src/keys.server.ts`, source: "export const secret = 1\n" },
  ];
  const d = check([...app, ...files], { types: false }).diagnostics.filter((x) => x.code === "E1004");
  expect(d.map((x) => x.path)).toEqual([`${LIB}/src/Badge.tsx`]);
  expect(d[0]?.message).toContain("server-only");
});

it("the artifacts the compile hands rules hold a library's styles: E1804 with tokens reports a library's pair, in the app (k.looks Library contrast)", () => {
  const tokens = { color: { mid: "#949494", white: "#ffffff" }, fontSize: { sm: "14px" } };
  const files = [
    {
      path: `${LIB}/src/Badge.tsx`,
      source: badge("").replace(
        "<Box id={`${props.id}.box`} />",
        '<Box id={`${props.id}.box`} fg="mid" bg="white">x</Box>',
      ),
    },
  ];
  const found = at("E1804", files, { artifacts: { tokens } });
  expect(found).toHaveLength(1);
  expect(found.some((p) => p.startsWith("node_modules/"))).toBe(false);
});

// The type pass with the kernel installed: a contract type error (E1510) in a library file is the app twin's.
const root = tempDir("keel-library-reach-");
afterAll(() => rmSync(root, { recursive: true, force: true }));
mkdirSync(join(root, "node_modules"), { recursive: true });
writeFileSync(join(root, "package.json"), "{}");
symlinkSync(
  fileURLToPath(new URL("../../../apps/golden-1/node_modules/@keel", import.meta.url)),
  join(root, "node_modules", "@keel"),
);
const API =
  "import { contract } from '@keel/router/contract'\nimport { s } from '@keel/schema'\nexport const a = contract('charts', { 'charts.list': { method: 'GET', path: '/api/list', output: s.object({}), search: s.object({}) } })\n";

it("E1510: a contract type error in a library file is reported as in the same file of an app module, the kernel installed", () => {
  const lib = check([...app, { path: `${LIB}/src/routes.ts`, source: API }], { root }).diagnostics;
  const own = check([...app, { path: "modules/charts/src/routes.ts", source: API }], { root }).diagnostics;
  const codes = (d: typeof lib, p: string) =>
    d
      .filter((x) => x.path === p)
      .map((x) => x.code)
      .sort();
  expect(codes(own, "modules/charts/src/routes.ts")).toContain("E1510");
  expect(codes(lib, `${LIB}/src/routes.ts`)).toEqual(codes(own, "modules/charts/src/routes.ts"));
});
