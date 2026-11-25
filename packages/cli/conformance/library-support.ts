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
  readonly exports?: Record<string, string | Record<string, string>>;
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

// ---- slice 3: `keel pack` and `keel scaffold library` ----
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { materialize as linked } from "./boundary-support.ts";

export const REPO = fileURLToPath(new URL("../../..", import.meta.url));
export const LIB_NAME = "@acme/keel-charts";
export const LIB_BASE = "keel-charts";
export const LIB_ID = "keelCharts";

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
export const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** A scratch folder whose `node_modules` holds the repo's packages, plus `keel` and `tsc` shims in `.bin`, so a package manager's scripts find them. */
export function scratch(): string {
  const dir = realpathSync(linked({}));
  const bin = join(dir, "node_modules/.bin");
  mkdirSync(bin, { recursive: true });
  const shims: [string, string][] = [
    ["keel", join(REPO, "packages/cli/src/bin.ts")],
    ["tsc", join(REPO, "node_modules/typescript/bin/tsc")],
  ];
  for (const [name, target] of shims) {
    const p = join(bin, name);
    writeFileSync(p, `#!/bin/sh\nexec "${process.execPath}" "${target}" "$@"\n`);
    chmodSync(p, 0o755);
  }
  return dir;
}

/** Links `<lib>/node_modules` to the scratch folder's: the library's dependencies are installed. */
export function installDeps(lib: string, scratchDir: string): void {
  symlinkSync(join(scratchDir, "node_modules"), join(lib, "node_modules"));
}

/** `keel scaffold library <name>` in `cwd`. */
export const scaffoldLibrary = (cwd: string, name: string, extra: string[] = []): Run =>
  keel(cwd, ["scaffold", "library", name, ...extra]);

/** A scaffolded library: a scratch folder, `keel scaffold library @acme/keel-charts` run in it, its dependencies installed. */
export function scaffolded(): { scratchDir: string; lib: string; run: Run } {
  const scratchDir = scratch();
  const run = scaffoldLibrary(scratchDir, LIB_NAME);
  const lib = join(scratchDir, LIB_BASE);
  if (existsSync(lib)) installDeps(lib, scratchDir);
  return { scratchDir, lib, run };
}

let clones = 0;
/** A copy of the library folder `from` beside it (its `node_modules` link made again), for a case that edits it. */
export function cloneLibrary(from: string): string {
  const to = join(dirname(from), `copy${++clones}`);
  cpSync(from, to, { recursive: true, filter: (src) => basename(src) !== "node_modules" });
  installDeps(to, dirname(from));
  return to;
}

/** Every path under `dir` but its root `node_modules`, to its text (`dir` for a folder, `link` for a link): what "writes no file" compares. */
export function snapshot(dir: string, rel = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of readdirSync(join(dir, rel)).sort()) {
    if (rel === "" && name === "node_modules") continue;
    const p = rel === "" ? name : `${rel}/${name}`;
    const st = lstatSync(join(dir, p));
    if (st.isSymbolicLink()) out[p] = "link";
    else if (st.isDirectory()) {
      out[p] = "dir";
      Object.assign(out, snapshot(dir, p));
    } else out[p] = readFileSync(join(dir, p), "utf8");
  }
  return out;
}

export const readText = (dir: string, rel: string): string => readFileSync(join(dir, rel), "utf8");

/** The parsed JSON file at `rel` under `dir`, or undefined when it is missing or not JSON. */
export function readJson(dir: string, rel: string): unknown {
  try {
    return JSON.parse(readText(dir, rel));
  } catch {
    return undefined;
  }
}

/** `keel pack` (or `keel pack --check`) in `dir`. */
export const pack = (dir: string, check = false): Run => keel(dir, check ? ["pack", "--check"] : ["pack"]);

/** The names among `check`, `test`, `ledger` and `kind` a message holds as whole words, in that order. */
export const stepsNamed = (message: unknown): string[] =>
  ["check", "test", "ledger", "kind"].filter((s) => new RegExp(`\\b${s}\\b`).test(str(message)));

/** Whether `run` holds exactly one E1164 whose message begins with `step` and a colon, and names no other of `check`, `test`, `ledger`, `kind`. */
export const namesOnly = (run: Run, step: string): boolean => {
  const found = run.records.filter((r) => r.kind === "diag" && r.code === "E1164");
  return (
    found.length === 1 && str(found[0]?.message).startsWith(`${step}:`) && stepsNamed(found[0]?.message).join() === step
  );
};

/** `src/index.ts` and `src/Example.tsx` of a scaffolded library written again: `head` the imports, `body` the expression `Example` returns. */
export function writeExample(lib: string, body: string, head = ""): void {
  writeFileSync(join(lib, "src/index.ts"), "export { default as Example } from './Example.tsx'\n");
  writeFileSync(
    join(lib, "src/Example.tsx"),
    `${head}export default function Example(props: { id: string }) {\n  return ${body}\n}\n`,
  );
}

/** `unsafe/raw.ts`, a file `keel check` reads clean: one export named as its file, one counted `unsafe(...)` call with a reason of eight words or more. */
export const CLEAN_UNSAFE =
  'declare function unsafe<T>(why: string, fn: () => T): T;\nexport const raw = unsafe("fixture call counted by the ledger and held by this test", () => 1);\n';

/** A `src/Example.tsx` rendering one `Text` and `n` labelled `Host` elements (none when `n` is 0): a library `keel check` reads clean (its schema in a `*.schema.ts` file, its code a `hostCode`, a `Box` for the wrapper). */
export function exampleWithHost(lib: string, n: number): void {
  const host = (i: number): string =>
    `<Host id={\`\${props.id}.c${i}\`} role="img" label="L" input={In} value={{ n: 1 }} code={() => import('./chart.ts').then((m) => m.chart)} />`;
  writeFileSync(
    join(lib, "src/In.schema.ts"),
    "import { s } from '@keel/schema'\nexport const In = s.object({ n: s.number() })\n",
  );
  writeFileSync(
    join(lib, "src/chart.ts"),
    "import { hostCode } from '@keel/ui'\nexport const chart = hostCode<{ n: number }>({ mount: () => undefined })\n",
  );
  writeFileSync(join(lib, "src/index.ts"), "export { default as Example } from './Example.tsx'\n");
  writeFileSync(
    join(lib, "src/Example.tsx"),
    `import { s } from '@keel/schema'\nimport { Box, Host, Text } from '@keel/ui'\nimport { In } from './In.schema.ts'\nexport const Props = s.object({ id: s.string() })\nexport default function Example(props: { id: string }) {\n  return (\n    <Box id={\`\${props.id}.box\`}>\n      <Text id={\`\${props.id}.text\`}>Example</Text>\n${Array.from({ length: n }, (_, i) => `      ${host(i)}\n`).join("")}    </Box>\n  )\n}\n`,
  );
}

/** The environment of a child process the way `keel()` gives it, without the package manager's own variables. */
function childEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || k.startsWith("VITEST") || k === "NODE_OPTIONS" || k === "TEST" || k === "KEEL_AGENT")
      continue;
    if (k.toLowerCase().startsWith("npm_")) continue;
    env[k] = v;
  }
  return env;
}

/** `pnpm pack` in `lib` into a new folder (its `prepack` runs unless `ignoreScripts`): the exit status, its output and the tarball made. */
export function packTarball(
  lib: string,
  ignoreScripts = false,
): { status: number | null; output: string; tgz: string | undefined } {
  const out = mkdtempSync(join(realpathSync(tmpdir()), "keel-tarball-"));
  const r = spawnSync(
    "pnpm",
    ["pack", "--pack-destination", out, ...(ignoreScripts ? ["--config.ignore-scripts=true"] : [])],
    {
      cwd: lib,
      encoding: "utf8",
      env: childEnv(),
      timeout: 600_000,
    },
  );
  const tgz = readdirSync(out).find((n) => n.endsWith(".tgz"));
  return { status: r.status, output: `${r.stdout}${r.stderr}`, tgz: tgz === undefined ? undefined : join(out, tgz) };
}

/** A copy of the tarball `tgz` (in a new folder) whose file `rel` is `edit` of its text: the files unpacked, one rewritten, packed again under the same top folder. */
export function editTarball(tgz: string, rel: string, edit: (text: string) => string): string {
  const work = mkdtempSync(join(realpathSync(tmpdir()), "keel-tarball-edit-"));
  spawnSync("tar", ["-xzf", tgz, "-C", work], { encoding: "utf8" });
  const file = join(work, "package", rel);
  writeFileSync(file, edit(readFileSync(file, "utf8")));
  const out = join(mkdtempSync(join(realpathSync(tmpdir()), "keel-tarball-")), "edited.tgz");
  spawnSync("tar", ["-czf", out, "-C", work, "package"], { encoding: "utf8" });
  return out;
}

/** The paths a tarball holds. */
export function tarEntries(tgz: string): string[] {
  const r = spawnSync("tar", ["-tzf", tgz], { encoding: "utf8" });
  return r.stdout.split("\n").filter((l) => l !== "");
}

/** Installs the tarball as a package manager's isolated layout holds it: the files under a store folder inside `node_modules`, `@keel` linked beside them, the package linked from the app's `node_modules`. */
export function installTarball(app: string, tgz: string, name = LIB_NAME): string {
  const store = join(app, "node_modules/.keel-store", name.replace("/", "+"), "node_modules");
  const real = join(store, name);
  mkdirSync(real, { recursive: true });
  spawnSync("tar", ["-xzf", tgz, "-C", real, "--strip-components=1"], { encoding: "utf8" });
  symlinkSync(join(app, "node_modules/@keel"), join(store, "@keel"));
  mkdirSync(dirname(join(app, "node_modules", name)), { recursive: true });
  symlinkSync(real, join(app, "node_modules", name));
  return real;
}

/** The app of the round trip: module `shop` listing `@acme/keel-charts` in `deps`, a `static` deployable `site` whose `/` page renders `<Example id="shop.example" />`, the app's `tokens.ts`. */
export const roundTripApp = (): Tree => ({
  ...project({ adapter: "static", page: false, deps: [LIB_NAME], libraries: [] }),
  "tokens.ts": TOKENS,
  "modules/shop/Home.tsx": `import { Box, Text } from '@keel/ui'\nimport { Example } from '${LIB_NAME}'\nexport default function Home() {\n  return (\n    <Box as="main">\n      <Text>shop</Text>\n      <Example id="shop.example" />\n    </Box>\n  )\n}\n`,
});

/** A new app of `roundTripApp` with the tarball of `lib` installed. */
export function appWithTarball(tgz: string): string {
  const app = realpathSync(linked(roundTripApp()));
  installTarball(app, tgz);
  return app;
}
