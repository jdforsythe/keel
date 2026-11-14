// True when the catalog page meets evals/tasks/golden-2-catalog/TASK.md acceptance, in this order: the app and its
// catalog files exist; no unsafe, `any`, casts or suppressions; the app's `check` script and `keel check`; `keel test`
// (the app's suite, which writes `reports/a11y.json`); every golden-2 ledger item at example or better and the ledger
// not regressed; every `a11y:recipes.catalog#` claim at example; the std-headless charts at their rungs; the existing
// golden-2 eval still passing; the build; the hidden suite (acceptance.test.ts, copied into the app, run, removed); the
// planted twin (a sibling copy whose DataTable gets `''` as the title header text) failing its render
// with E1703; and the browser pass (browser.ts). A failed gate prints one V0001 line.
import { execFile } from "node:child_process";
import { access, copyFile, cp, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import golden2 from "../golden-2/pass.ts";
import { browserPass } from "./browser.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");
const app = join(root, "apps", "golden-2");
const keelBin = join(root, "packages", "cli", "src", "bin.ts");
const vitest = join(root, "node_modules", ".bin", "vitest");
const ACCEPT = "test/__acceptance.test.ts";

const FILES: readonly string[] = [
  "modules/kitchen/CatalogRow.schema.ts",
  "modules/kitchen/CatalogSearch.schema.ts",
  "modules/kitchen/catalogColumns.ts",
  "modules/kitchen/routes.ts",
  "modules/recipes/CatalogPage.tsx",
  "modules/recipes/BoxShell.tsx",
  "modules/recipes/RecipesText/en-US.ts",
  "modules/recipes/RecipesText/de-DE.ts",
  "modules/recipes/RecipesText/ja-JP.ts",
  "test/catalog.test.ts",
  "test/catalogColumns.test.ts",
];
/** Each std-headless chart and the rung the ledger must show for it. */
const CHARTS: Readonly<Record<string, string>> = {
  "packages/std-headless/src/openChart.ts#openChart": "proven",
  "packages/std-headless/src/toastChart.ts#toastChart": "proven",
  "packages/std-headless/src/optionsChart.ts#optionsChart": "exhaustive",
};
const WIDGETS: readonly string[] = ["Combobox", "Listbox", "Disclosure", "Tabs", "DataTable", "TableSearch", "Menu", "Dialog"];
const SKIP_DIR = /(^|\/)(node_modules|\.keel|dist|coverage|reports)(\/|$)/;
const CODE = /\.(ts|tsx|mts|mjs|js)$/;
const BANNED = /\bunsafe\(|@ts-ignore|@ts-expect-error|\bas any\b|:\s*any\b|\bas unknown as\b/;
const TWIN_SKIP: ReadonlySet<string> = new Set(["node_modules", "dist", ".keel", ".turbo", "reports"]);

type Run = { ok: boolean; stdout: string };

const sh = (cmd: string, args: string[], cwd = root, extra: Record<string, string> = {}): Promise<Run> =>
  new Promise((resolve) => {
    const env = { ...process.env, KEEL_AGENT: "1", ...extra };
    execFile(cmd, args, { cwd, maxBuffer: 64 * 1024 * 1024, env }, (err, stdout) =>
      resolve({ ok: err === null, stdout: String(stdout) }),
    );
  });

const exists = (p: string): Promise<boolean> =>
  access(p).then(
    () => true,
    () => false,
  );

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const parse = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/** Prints the one line that says which gate failed, and fails. */
const fail = (why: string): false => {
  process.stderr.write(`V0001 evals/tasks/golden-2-catalog ${why}\n`);
  return false;
};

/** Walks the app without descending into node_modules, .keel, dist, coverage or reports. */
async function codeFiles(dir = "", out: string[] = []): Promise<string[]> {
  for (const e of await readdir(join(app, dir), { withFileTypes: true })) {
    const rel = dir === "" ? e.name : `${dir}/${e.name}`;
    if (SKIP_DIR.test(rel)) continue;
    if (e.isDirectory()) await codeFiles(rel, out);
    else if (CODE.test(rel)) out.push(rel);
  }
  return out.sort();
}

/** The ledger records `keel ledger --format=json [--scope <scope>]` prints from the repo root. */
async function ledger(scope?: string): Promise<Record<string, unknown>[]> {
  const args = [keelBin, "ledger", "--format=json", ...(scope === undefined ? [] : ["--scope", scope])];
  const r = await sh("node", args);
  return r.stdout
    .split("\n")
    .filter((l) => l.startsWith("{"))
    .map(parse)
    .filter(isRecord)
    .filter((x) => x.kind === "ledger");
}

/** The hidden suite in `dir` (the app or the twin), with `env`; true when vitest exits 0. */
async function hidden(dir: string, env: Record<string, string> = {}): Promise<boolean> {
  const target = join(dir, ACCEPT);
  await copyFile(join(here, "acceptance.test.ts"), target);
  const r = await sh(vitest, ["run", ACCEPT], dir, env).finally(() => rm(target, { force: true }));
  return r.ok;
}

/**
 * The planted twin: a sibling copy (so tsconfig, `node_modules` and workspace paths resolve as for the app) whose
 * DataTable `text.headers.title` is the empty string, then the hidden suite's twin test with `KEEL_TWIN=header`, which expects the
 * catalog's render to fail with E1703 (`empty-table-header`). A plant that changes nothing fails the twin.
 */
async function twin(): Promise<string | undefined> {
  const dir = await mkdtemp(join(root, "apps", ".golden-2-twin-"));
  try {
    await cp(app, dir, { recursive: true, filter: (src) => !TWIN_SKIP.has(basename(src)) });
    await symlink(join(app, "node_modules"), join(dir, "node_modules"));
    const file = join(dir, "modules", "recipes", "CatalogPage.tsx");
    const src = await readFile(file, "utf8");
    const planted = src.replace(/(headers:\s*\{[^}]*?\btitle:\s*)[^,}]+/, '$1""');
    if (planted === src) return "CatalogPage.tsx passes no headers.title to DataTable";
    await writeFile(file, planted);
    return (await hidden(dir, { KEEL_TWIN: "header" }))
      ? undefined
      : "an empty table header did not fail the catalog render with E1703";
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export default async (): Promise<boolean> => {
  if (!(await exists(app))) return fail("apps/golden-2 is absent");
  for (const f of FILES) if (!(await exists(join(app, f)))) return fail(`missing ${f}`);
  const files = (await codeFiles()).filter((f) => f !== ACCEPT);
  const text = new Map<string, string>();
  for (const f of files) text.set(f, await readFile(join(app, f), "utf8"));
  const all = [...text.values()].join("\n");
  if (BANNED.test(all)) return fail("unsafe, any, a cast or a suppression in the app");
  const page = text.get("modules/recipes/CatalogPage.tsx") ?? "";
  for (const w of WIDGETS) if (!page.includes(`<${w}`)) return fail(`CatalogPage.tsx renders no ${w}`);
  if (!(text.get("modules/recipes/BoxShell.tsx") ?? "").includes("<Toaster")) return fail("BoxShell renders no Toaster");
  const kitchen = [...text].filter(([f]) => f.startsWith("modules/kitchen/")).map(([, t]) => t);
  if (!kitchen.some((t) => t.includes("applyQuery("))) return fail("no kitchen loader calls applyQuery");

  if (!(await sh("pnpm", ["--filter", "golden-2", "check"])).ok) return fail("the app's check script failed");
  if (!(await sh("node", [keelBin, "check", "--quiet"], app)).ok) return fail("keel check failed");
  if (!(await sh("node", [keelBin, "test", "--quiet"], app)).ok) return fail("keel test failed");
  if (!(await exists(join(app, "reports", "a11y.json")))) return fail("keel test wrote no reports/a11y.json");
  if (!(await sh("pnpm", ["ledger", "--diff", "--scope", "golden-2:"])).ok) return fail("ledger --diff regressed");
  const items = await ledger("golden-2:");
  if (items.length === 0) return fail("the ledger has no golden-2 item");
  const none = items.find((r) => r.rung === "none");
  if (none !== undefined) return fail(`${String(none.item)} is at rung none`);
  const claims = await ledger("a11y:recipes.catalog#");
  if (claims.length === 0) return fail("no a11y claim for recipes.catalog");
  const low = claims.find((r) => r.rung !== "example");
  if (low !== undefined) return fail(`${String(low.item)} is at ${String(low.rung)}`);
  const charts = await ledger("packages/std-headless/");
  for (const [item, rung] of Object.entries(CHARTS)) {
    const got = charts.find((r) => r.item === item)?.rung;
    if (got !== rung) return fail(`${item} is at ${String(got)}, not ${rung}`);
  }
  if (!(await golden2())) return fail("the golden-2 eval no longer passes");
  if (!(await sh("pnpm", ["--filter", "golden-2", "build"])).ok) return fail("the build failed");
  if (!(await hidden(app))) return fail("the hidden suite failed");
  const planted = await twin();
  if (planted !== undefined) return fail(planted);
  const browser = await browserPass(root, app);
  if (browser !== undefined) return fail(`browser pass: ${browser}`);
  return true;
};
