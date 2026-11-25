// Fixture project for the k.library conformance files in this folder (not a test file). Seed 1337 for every property.
// The first Conformance clause of k.library as a `Tree` for `materialize` (boundary-support.ts): `modules/shop` listing `@acme/charts`,
// the library's files under `node_modules/@acme/charts/`. No std package appears in it: the library is written here.
import { type Tree, base, manifestSrc } from "./boundary-support.ts";

export { SEED, SLOW, built, cleanup, filesUnder, keelRun, materialize, recordsOf, write } from "./boundary-support.ts";
export type { Tree } from "./boundary-support.ts";
export { diags, keel } from "./compat-support.ts";
export type { Rec } from "./compat-support.ts";

export const NAME = "@acme/charts";
export const LIB = "node_modules/@acme/charts";

/** The ledger file of a library with no `unsafe` and no host element (ASSUMED shape: k.ledger File). */
export const LEDGER = `${JSON.stringify({ version: 1, unsafe: 0, hostElements: 0, rungs: {}, mutation: {}, exports: [], clauses: [], a11y: [] })}\n`;

export const manifestOf = (id: string, deps: string[], exports: string[] = []): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${JSON.stringify(deps).replaceAll('"', "'")}, capabilities: [], public: { exports: ${JSON.stringify(exports).replaceAll('"', "'")} } })\n`;

export type LibraryShape = {
  readonly name?: string;
  readonly id?: string;
  readonly deps?: string[];
  /** Added to the `exports` of `package.json`, beside `"."`. */
  readonly exports?: Record<string, string>;
  /** Extra files, relative to the package folder. */
  readonly files?: Tree;
  readonly keel?: string | null;
  readonly ledger?: boolean;
};

/** An installed library: `package.json`, `index.js`, `module.ts`, `src/index.ts`, `src/Badge.tsx` and `.keel/ledger.json`. */
export function library(sh: LibraryShape = {}): Tree {
  const name = sh.name ?? NAME;
  const root = `node_modules/${name}`;
  const pkg = {
    name,
    version: "1.0.0",
    type: "module",
    ...(sh.keel === null ? {} : { keel: sh.keel ?? "library" }),
    exports: { ".": { keel: "./src/index.ts", default: "./index.js" }, ...sh.exports },
  };
  const out: Tree = {
    [`${root}/package.json`]: JSON.stringify(pkg),
    [`${root}/index.js`]: "export {}\n",
    [`${root}/module.ts`]: manifestOf(sh.id ?? "charts", sh.deps ?? [], ["Badge"]),
    [`${root}/src/index.ts`]: "export { default as Badge } from './Badge.tsx'\n",
    [`${root}/src/Badge.tsx`]:
      "import { Box } from '@keel/ui'\nexport default function Badge(props: { id: string }) {\n  return <Box id={`${props.id}.box`} p=\"2\" />\n}\n",
  };
  if (sh.ledger !== false) out[`${root}/.keel/ledger.json`] = LEDGER;
  for (const [rel, text] of Object.entries(sh.files ?? {})) out[`${root}/${rel}`] = text;
  return out;
}

export type ProjectShape = {
  /** `deps` of `modules/shop/module.ts` (default: the library). */
  readonly deps?: string[];
  /** `modules` of the one deployable `api` (default: `['shop']`). */
  readonly modules?: string[];
  /** `modules/shop/Page.tsx` importing `Badge` from the library; the build fixtures leave it out (see library-deps.test.ts). */
  readonly page?: boolean;
  /** The one deployable's adapter: `node` (named `api`, the default) or `static` (named `site`, whose build writes `dist/site/index.html` for `/`). */
  readonly adapter?: "node" | "static";
  /** `modules/shop/Home.tsx`, the page at `/`, renders `<Badge id="shop.badge" />` from the library. */
  readonly home?: boolean;
  readonly libraries?: Tree[];
};

/** The project of the first Conformance clause of k.library: the app module `shop`, a node deployable `api`, the libraries. */
export function project(sh: ProjectShape = {}): Tree {
  const page = sh.page ?? true;
  return {
    ...base(),
    "topology.ts": `import { topology } from '@keel/server'\nexport default topology({ ${sh.adapter === "static" ? "site" : "api"}: { modules: ${JSON.stringify(sh.modules ?? ["shop"]).replaceAll('"', "'")}, adapter: '${sh.adapter ?? "node"}' } })\n`,
    "modules/shop/module.ts": manifestSrc("shop").replace(
      "deps: []",
      `deps: ${JSON.stringify(sh.deps ?? [NAME]).replaceAll('"', "'")}`,
    ),
    "modules/shop/shop.contract.ts":
      "import { contract } from '@keel/router/contract'\nexport const shop = contract('shop', { 'shop.home': { path: '/' } })\n",
    "modules/shop/Home.tsx": sh.home
      ? `import { Box, Text } from '@keel/ui'\nimport { Badge } from '${NAME}'\nexport default function Home() {\n  return (\n    <Box as="main">\n      <Text>shop</Text>\n      <Badge id="shop.badge" />\n    </Box>\n  )\n}\n`
      : "import { Box, Text } from '@keel/ui'\nexport default function Home() {\n  return (\n    <Box as=\"main\">\n      <Text>shop</Text>\n    </Box>\n  )\n}\n",
    "modules/shop/routes.ts":
      "import { manifest } from '@keel/router'\nimport Home from './Home.tsx'\nimport { shop } from './shop.contract.ts'\nexport const routes = manifest(shop, { 'shop.home': { component: Home } })\n",
    ...(page
      ? {
          "modules/shop/Page.tsx": `import { Badge } from '${NAME}'\nexport default function Page() {\n  return <Badge id="shop.badge" />\n}\n`,
        }
      : {}),
    ...Object.assign({}, ...(sh.libraries ?? [library()])),
  };
}

/** A rule registered from a library's `./tools` export: `code` on line 1 of every app file. */
export const toolsRule = (code: string): string => `import { defineRule } from "@keel/check";
defineRule({
  code: "${code}",
  message: "library rule ran",
  see: "k.library",
  explain: "Fixture rule a library's ./tools export registers.",
  check: ({ file }) => [{ path: file.path, line: 1, col: 1 }],
});
`;

/** A `./routes` export holding the route `charts.about` at `/about`. */
export const ROUTES_JS = `import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
const charts = contract("charts", { "charts.about": { path: "/about" } });
export const routes = manifest(charts, { "charts.about": { component: () => null } });
`;

// ---- slice 2b: the ledger over libraries ----
import { mkdirSync, readFileSync, renameSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { type Rec, type Run, keel } from "./compat-support.ts";

/** A ledger file as `JSON.stringify` and a line feed write it, `over` replacing keys of the valid empty file. */
export const shipped = (over: Record<string, unknown> = {}): string =>
  `${JSON.stringify({ version: 1, unsafe: 0, hostElements: 0, exports: [], ...over })}\n`;

/** The `Badge` entry of a library ledger's `exports`, at `rung`. */
export const badgeEntry = (rung: string): Record<string, string> => ({
  pkg: "charts",
  name: "Badge",
  file: "src/Badge.tsx",
  rung,
});

/** `n` counted `unsafe(...)` calls (none when `n` is 0), as a file. */
export const unsafeSrc = (n: number): string =>
  n === 0
    ? "export const nothing = 1\n"
    : `declare function unsafe<T>(why: string, fn: () => T): T;\n${Array.from({ length: n }, (_, i) => `export const raw${i} = unsafe("fixture: counted", () => ${i});`).join("\n")}\n`;

/** Library files holding `n` `Host` elements in `src/Chart.tsx` (none when `n` is 0). */
export function hostFiles(n: number): Tree {
  if (n === 0) return {};
  const el = (i: number): string =>
    `<Host id={\`\${props.id}.c${i}\`} role="img" label="L" input={In} value={{ n: 1 }} code={() => import('./chart.ts').then((m) => m.chart)} />`;
  return {
    "src/chart.ts": "export const chart = undefined\n",
    "src/Chart.tsx": `import { s } from '@keel/schema'\nimport { Host } from '@keel/ui'\nconst In = s.object({ n: s.number() })\nexport default function Chart(props: { id: string }) {\n  return <div>{${Array.from({ length: n }, (_, i) => el(i)).join("")}}</div>\n}\n`,
  };
}

/** Whether `r` lies on the `'entry'` of the file `tree` holds at `r.path`, from its opening quote to its closing one. */
export function atEntryOf(tree: Tree, r: Rec, entry: string): boolean {
  const src = typeof r.path === "string" ? (tree[r.path] ?? "") : "";
  const idx = src.indexOf(`'${entry}'`);
  if (idx < 0 || typeof r.line !== "number" || typeof r.col !== "number") return false;
  const before = src.slice(0, idx);
  const quoteCol = idx - before.lastIndexOf("\n");
  return r.line === before.split("\n").length && r.col >= quoteCol && r.col <= quoteCol + entry.length + 1;
}

/** The last `summary` record's `counts` of `run`. */
export const countsOf = (run: Run): unknown => run.records.filter((r) => r.kind === "summary").at(-1)?.counts;

/** The `ledger` records of `run`, in order. */
export const ledgerRecs = (run: Run): Rec[] => run.records.filter((r) => r.kind === "ledger");

/** `keel ledger --write <out>` in `dir`, and the file it wrote parsed (undefined when none) beside its text. */
export function writeLedger(
  dir: string,
  out = "out.json",
  extra: string[] = [],
): { run: Run; text: string; json: unknown } {
  const run = keel(dir, ["ledger", "--write", out, ...extra]);
  let text = "";
  try {
    text = readFileSync(join(dir, out), "utf8");
  } catch {
    text = "";
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { run, text, json };
}

/** Moves the installed library of `dir` to `<dir>-lib/charts` and links it back, as a linked package outside the project root; returns the folder to clean up. */
export function linkBeside(dir: string, name = NAME): string {
  const beside = `${dir}-lib`;
  const real = join(beside, "pkg");
  mkdirSync(beside, { recursive: true });
  renameSync(join(dir, "node_modules", name), real);
  symlinkSync(real, join(dir, "node_modules", name));
  symlinkSync(join(dir, "node_modules"), join(beside, "node_modules"));
  return beside;
}

/** Moves the installed library of `dir` to `<dir>/<rel>` and links it back: a library whose real path is inside the project root. */
export function linkInside(dir: string, rel: string, name = NAME): void {
  const real = join(dir, rel);
  mkdirSync(dirname(real), { recursive: true });
  renameSync(join(dir, "node_modules", name), real);
  symlinkSync(real, join(dir, "node_modules", name));
}

/** The app's `tokens.ts` of the `site` project: a color pair and the space scale `p="2"` reads. */
export const TOKENS =
  'import { defineTokens } from "@keel/ui";\nexport const tokens = defineTokens({ color: { fg: "#111111", bg: "#ffffff" }, space: { 1: "4px", 2: "8px", 3: "16px" } });\n';

/** The `site` project of the second Conformance clause of k.library: `project` with a `static` deployable `site` whose `/` page renders `<Badge id="shop.badge" />`, and the app's `tokens.ts`. */
export const siteTree = (libraries?: Tree[]): Tree => ({
  ...project({ adapter: "static", home: true, ...(libraries === undefined ? {} : { libraries }) }),
  "tokens.ts": TOKENS,
});

/** The library's `src/Badge.tsx` in a project tree. */
export const BADGE_PATH = `${LIB}/src/Badge.tsx`;
