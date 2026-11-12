// True when golden app 1 meets evals/tasks/golden-1-api/TASK.md acceptance: files exist, check and tests green,
// properties cover transactions and components, every golden-1 ledger item at rung example or better, ledger not regressed,
// unsafe count 0, build green, quiet output within budgets, and the split proof: the hidden in-process suite
// (acceptance.test.ts, copied into the app, run, and removed) and the built processes (splitBuilt.ts).
import { execFile } from "node:child_process";
import { access, copyFile, readFile, readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { splitBuilt } from "./splitBuilt.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");
const app = join(root, "apps", "golden-1");
const mod = "modules/todos";
const api = "modules/api";
const digest = "modules/digest";
const ACCEPT = "test/__acceptance.test.ts";

const FILES: readonly string[] = [
  "package.json",
  "tsconfig.json",
  "vite.config.ts",
  "tokens.ts",
  "topology.ts",
  ...["module", "routes"].map((n) => `${api}/${n}.ts`),
  ...[
    "board",
    "boardStores",
    "addList",
    "addTodo",
    "toggleTodo",
    "editTodo",
  ].map((n) => `${api}/${n}.ts`),
  `${api}/TodoIdParams.schema.ts`,
  ...["TodoList", "Todo", "Board", "BoardView", "ListDraft", "TodoDraft", "Suggestion", "ListParams"].map(
    (n) => `${api}/${n}.schema.ts`,
  ),
  ...["loadBoard", "loadSuggestions", "postList", "postTodo", "postEdit", "postToggle", "postUndo"].map(
    (n) => `${api}/${n}.server.ts`,
  ),
  ...["module", "routes", "editable.guard", "view", "hydrate", "refreshView", "syncAfter", "todosApi"].map(
    (n) => `${mod}/${n}.ts`,
  ),
  ...["todos", "suggestions"].map((n) => `${mod}/${n}.service.ts`),
  ...[
    "BoardReply",
    "ActionReply",
    "FieldsReply",
    "SuggestionsReply",
    "ListSearch",
    "TodoParams",
  ].map((n) => `${mod}/${n}.schema.ts`),
  ...["loadIndex", "loadList", "loadTodo", "createList", "createTodo", "updateTodo"].map(
    (n) => `${mod}/${n}.server.ts`,
  ),
  ...["AppShell", "ListsPage", "ListPage", "TodoRow", "EditTodoPage", "ListError", "Suggestions"].map(
    (n) => `${mod}/${n}.tsx`,
  ),
  ...[
    "module",
    "routes",
    "Digest.schema",
    "RecountInput.schema",
    "ListsReply.schema",
    "board.service",
    "boardApi",
    "LATEST_KEY",
    "readLatest",
    "writeLatest",
  ].map((n) => `${digest}/${n}.ts`),
  ...["recount", "jobs", "schedules", "runners", "loadDigest", "feedDigest", "refresh"].map(
    (n) => `${digest}/${n}.server.ts`,
  ),
  ...["api", "board", "components", "routes", "digest"].map((n) => `test/${n}.test.ts`),
  "test/simApi.ts",
  "test/apiRoutes.ts",
];
const PROPERTY_TARGETS: readonly string[] = [
  "addList",
  "addTodo",
  "toggleTodo",
  "editTodo",
  "hydrate",
  "TodoRow",
  "Suggestions",
];
const SKIP_DIR = /(^|\/)(node_modules|\.keel|dist|coverage)(\/|$)/;
const CODE = /\.(ts|tsx|mts|mjs|js)$/;

type Run = { ok: boolean; stdout: string };

const sh = (cmd: string, args: string[], cwd = root): Promise<Run> =>
  new Promise((resolve) => {
    execFile(cmd, args, { cwd, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, KEEL_AGENT: "1" } }, (err, stdout) =>
      resolve({ ok: err === null, stdout: String(stdout) }),
    );
  });

const exists = (p: string): Promise<boolean> =>
  access(p).then(
    () => true,
    () => false,
  );

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const tokens = (s: string): number => Math.ceil(s.length / 4);

/** Walks the app without descending into node_modules, .keel, dist, coverage (a recursive readdir follows workspace links and exhausts memory). */
async function codeFiles(dir = "", out: string[] = []): Promise<string[]> {
  const entries = await readdir(join(app, dir), { withFileTypes: true });
  for (const e of entries) {
    const rel = dir === "" ? e.name : `${dir}/${e.name}`;
    if (SKIP_DIR.test(rel)) continue;
    if (e.isDirectory()) await codeFiles(rel, out);
    else if (CODE.test(rel)) out.push(rel);
  }
  return out.sort();
}

async function outputBudget(key: string): Promise<number> {
  const raw: unknown = JSON.parse(await readFile(join(root, "tooling", "budgets.json"), "utf8"));
  const output = isRecord(raw) ? raw.output : undefined;
  const v = isRecord(output) ? output[key] : undefined;
  return typeof v === "number" ? v : 0;
}

/**
 * Every golden-1 ledger item, computed now by `keel ledger --scope golden-1:` (not read from the committed ledger.json,
 * which the agent may not edit), must be at rung example or better.
 */
async function ledgerItemsProven(): Promise<boolean> {
  const r = await sh("node", [
    join(root, "packages", "cli", "src", "bin.ts"),
    "ledger",
    "--format=json",
    "--scope",
    "golden-1:",
  ]);
  const items = r.stdout
    .split("\n")
    .filter((l) => l.includes('"kind":"ledger"'))
    .map((l): unknown => JSON.parse(l));
  return items.length > 0 && items.every((e) => isRecord(e) && typeof e.rung === "string" && e.rung !== "none");
}

/** The hidden in-process split suite, copied into the app's tests, run with its vitest config, and removed. */
async function acceptance(): Promise<boolean> {
  const target = join(app, ACCEPT);
  await copyFile(join(here, "acceptance.test.ts"), target);
  const r = await sh("pnpm", ["--filter", "golden-1", "exec", "vitest", "run", ACCEPT]).finally(() =>
    rm(target, { force: true }),
  );
  return r.ok;
}

export default async (): Promise<boolean> => {
  for (const f of FILES) if (!(await exists(join(app, f)))) return false;
  if (await exists(join(app, "server.ts"))) return false;

  const files = (await codeFiles()).filter((f) => f !== ACCEPT);
  const read = async (f: string): Promise<string> => readFile(join(app, f), "utf8");
  const tests = files.filter((f) => f.startsWith("test/"));
  const sources = files.filter((f) => !f.startsWith("test/"));
  const testText = (await Promise.all(tests.map(read))).join("\n");

  // Unsafe count 0 anywhere in the app.
  for (const f of files) if ((await read(f)).includes("unsafe(")) return false;

  // Invariant declared beside the store; properties for every transaction and the two components.
  if (!(await read(`${api}/board.ts`)).includes("invariant(")) return false;
  const serverText = (
    await Promise.all(sources.filter((f) => f.startsWith(`${api}/`) && f.endsWith(".server.ts")).map(read))
  ).join("\n");
  if (!/\bstores:/.test(serverText)) return false;
  if (!testText.includes("@keel/testing")) return false;
  for (const t of PROPERTY_TARGETS) if (!new RegExp(`\\bproperties\\(\\s*${t}\\b`).test(testText)) return false;

  // The kernel rules over the app itself (root `pnpm check` runs only the app's tsc + biome script).
  const keel = await sh("node", [join(root, "packages", "cli", "src", "bin.ts"), "check", "--quiet"], app);
  if (!keel.ok) return false;
  const check = await sh("pnpm", ["check", "--quiet"]);
  if (!check.ok || tokens(check.stdout) > (await outputBudget("check.injected10"))) return false;
  const test = await sh("pnpm", ["test", "--quiet", "--filter", "golden-1"]);
  if (!test.ok || tokens(test.stdout) > (await outputBudget("test.failing3"))) return false;
  if (!(await sh("pnpm", ["ledger", "--diff", "--scope", "golden-1:"])).ok) return false;
  const build = await sh("pnpm", ["--filter", "golden-1", "build"]);
  if (!build.ok) return false;
  if (!(await ledgerItemsProven())) return false;
  if (!(await acceptance())) return false;
  const split = await splitBuilt(root);
  if (split !== undefined) process.stderr.write(`V0001 evals/tasks/golden-1-api/splitBuilt.ts ${split}\n`);
  return split === undefined;
};
