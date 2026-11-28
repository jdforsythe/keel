// k.library, the clause on a library file read as a file under `modules/<id>/`, quoted whole (it is the second bullet of "In an app"; the bullet runs on to the bare import sentence, quoted whole too):
// In an app (check): "`keel check` runs every rule but E1106 (k.formats Who declares) over them, the type pass included, against the app's `tokens.ts`, kernel packages and `topology.ts`. Where a section reads app code or `modules/<id>/` (k.check App code, k.boundary Reach), it reads a library's file `<f>` as `modules/<id>/<f>`, its `unsafe/` files with their lifted ranges. A diagnostic in one is the app's, at `node_modules/<name>/<f>`, with no `fix`; nothing turns a rule off there. A bare import there resolves from the library's folder, to one of its `dependencies`, and is no E1163."
// Reach (k.boundary): "**Reach.** Client-reachable code (E1004 and E1571; E1107 has its own, k.leave), with a `topology.ts`: a file under `modules/<id>/`, not server-only, of a `node` or `static` module (one such a deployable lists); a file of a `client` module, for imports of another module's server-only files; and a project file outside `node_modules/` a client entry reaches by value imports, re-exports and literal `import()`, not through a server-only file. Client entries: each route `component` of a `node` or `static` module and every file of a `client` one. No `topology.ts`: every file but server-only ones. A `routes.ts` may import server-only files by value; a specifier with a query names its file; package imports are not followed (E1007 covers them). An E1004 found through a chain ends `(<entry> -> … -> <file>)`."
// Seed 1337 (no generated input).
// ASSUMPTIONS (spec silent): k.library names no sentence for what the client reach follows into a library; the reading asserted is "it reads a library's file `<f>` as it reads `modules/<id>/<f>`, a section's exclusion of `node_modules/` does not cover library files":
// a route component of a `node` module that imports a library by its package name reaches the library's files named by its `exports` (the `keel` condition's target) and, from them, by relative imports; a library's module is listed by no deployable, so a library file the client does not reach is no browser file.
// A file `*.server.ts` of a library is server-only (a library's module is one no `client` deployable lists). E1759 is the `node:` import an app file is refused for in a browser file (k.check).
import { check } from "@keel/check";
import { expect, test } from "vitest";
import { type Files, manifestFile } from "./module-support.ts";

const NAME = "@acme/charts";
const ROOT = `node_modules/${NAME}`;
const LEDGER = `${JSON.stringify({ version: 1, unsafe: 0, hostElements: 0, rungs: {}, mutation: {}, exports: [], clauses: [], a11y: [] })}\n`;
const TOPOLOGY = `import { topology } from '@keel/server'\nexport default topology({ api: { modules: ['shop'], adapter: 'node' } })\n`;
const BADGE = (head: string): string =>
  `import { Box } from '@keel/ui'\n${head}export default function Badge(props: { id: string }) {\n  return <Box id={\`\${props.id}.box\`} />\n}\n`;

/** The app `shop` (a route component `Page` rendering the library's `Badge`, a `node` deployable `api`) and the library, `extra` adding to or replacing by path. */
function project(extra: Files = []): Files {
  const base: Files = [
    { path: "topology.ts", source: TOPOLOGY },
    manifestFile({ id: "shop", deps: [NAME] }),
    {
      path: "modules/shop/shop.contract.ts",
      source:
        "import { contract } from '@keel/router/contract'\nexport const shop = contract('shop', { 'shop.home': { path: '/' } })\n",
    },
    {
      path: "modules/shop/routes.ts",
      source:
        "import { manifest } from '@keel/router'\nimport { shop } from './shop.contract.ts'\nimport Page from './Page.tsx'\nexport const routes = manifest(shop, { 'shop.home': { component: Page } })\n",
    },
    {
      path: "modules/shop/Page.tsx",
      source: `import { Badge } from '${NAME}'\nexport default function Page() { return <Badge id="shop.badge" /> }\n`,
    },
    {
      path: `${ROOT}/package.json`,
      source: JSON.stringify({
        name: NAME,
        version: "1.0.0",
        type: "module",
        keel: "library",
        exports: { ".": { keel: "./src/index.ts", default: "./index.js" } },
      }),
    },
    { path: `${ROOT}/index.js`, source: "export {}\n" },
    manifestFile({ id: "charts", deps: [], exports: ["Badge"] }, ROOT),
    { path: `${ROOT}/src/index.ts`, source: "export { default as Badge } from './Badge.tsx'\n" },
    { path: `${ROOT}/src/Badge.tsx`, source: BADGE("") },
    { path: `${ROOT}/.keel/ledger.json`, source: LEDGER },
  ];
  const own = new Set(extra.map((x) => x.path));
  return [...base.filter((b) => !own.has(b.path)), ...extra];
}
const lib = (rel: string, source: string) => ({ path: `${ROOT}/${rel}`, source });
const hits = (files: Files, code: string) => check(files, { types: false }).diagnostics.filter((d) => d.code === code);
const KEYS = lib("src/keys.server.ts", "export const key = 'k'\n");
const NODE_FS = "import { readFileSync } from 'node:fs'\nexport const r = readFileSync\n";

test("a route component reaching a library's server-only file through the library's `exports` entry is one E1004, at the import in the library file, at the library's path", () => {
  const files = project([KEYS, lib("src/Badge.tsx", BADGE("import { key } from './keys.server.ts'\nvoid key\n"))]);
  const d = hits(files, "E1004");
  expect(d.length).toBe(1);
  expect(d[0]?.path).toBe(`${ROOT}/src/Badge.tsx`);
  expect(d[0]?.fix).toBeUndefined();
});

test("the same import in a library file no client entry reaches, or a type-only import of it, is no E1004", () => {
  const unreached = project([
    KEYS,
    lib("src/Other.ts", "import { key } from './keys.server.ts'\nexport const o = key\n"),
  ]);
  expect(hits(unreached, "E1004")).toEqual([]);
  const typeOnly = project([KEYS, lib("src/Badge.tsx", BADGE("import type { key } from './keys.server.ts'\n"))]);
  expect(hits(typeOnly, "E1004")).toEqual([]);
});

test("a library file the client reaches is a browser file: `node:fs` imported by one a route component reaches is one E1759, at the library's path with no fix", () => {
  const files = project([lib("src/Read.ts", NODE_FS), lib("src/Badge.tsx", BADGE("import './Read.ts'\n"))]);
  const d = hits(files, "E1759");
  expect(d.map((x) => x.path)).toEqual([`${ROOT}/src/Read.ts`]);
  expect(d[0]?.fix).toBeUndefined();
});

test("a library file the client does not reach importing `node:fs` is no finding", () => {
  const files = project([lib("src/Read.ts", NODE_FS)]);
  expect(hits(files, "E1759")).toEqual([]);
});
