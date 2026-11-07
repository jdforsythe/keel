// True when golden app 1 meets evals/tasks/golden-1/TASK.md acceptance: files exist, check and tests green,
// properties cover transactions and components, every golden-1 ledger item at rung example or better, ledger not regressed,
// unsafe count 0, quiet output within budgets.
import { execFile } from "node:child_process";
import { access, readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const app = join(root, "apps", "golden-1");
const mod = "modules/todos";

const FILES: readonly string[] = [
  "package.json",
  "tsconfig.json",
  "vite.config.ts",
  "tokens.ts",
  "topology.ts",
  ...["module", "routes", "editable.guard"].map((n) => `${mod}/${n}.ts`),
  ...["TodoList", "Todo", "Board", "ListDraft", "TodoDraft", "Suggestion"].map((n) => `${mod}/${n}.schema.ts`),
  ...["board", "addList", "addTodo", "toggleTodo", "editTodo"].map((n) => `${mod}/${n}.ts`),
  ...["loadList", "loadTodo", "createList", "createTodo", "updateTodo"].map((n) => `${mod}/${n}.server.ts`),
  ...["AppShell", "ListsPage", "ListPage", "TodoRow", "EditTodoPage", "ListError", "Suggestions"].map(
    (n) => `${mod}/${n}.tsx`,
  ),
  ...["board", "routes", "components"].map((n) => `test/${n}.test.ts`),
];
const PROPERTY_TARGETS: readonly string[] = ["addList", "addTodo", "toggleTodo", "editTodo", "TodoRow", "Suggestions"];
const SKIP_DIR = /(^|\/)(node_modules|\.keel|dist|coverage)(\/|$)/;
const CODE = /\.(ts|tsx|mts|mjs|js)$/;

type Run = { ok: boolean; stdout: string };

const sh = (cmd: string, args: string[]): Promise<Run> =>
  new Promise((resolve) => {
    execFile(
      cmd,
      args,
      { cwd: root, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, KEEL_AGENT: "1" } },
      (err, stdout) => resolve({ ok: err === null, stdout: String(stdout) }),
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

/** Every golden-1 item in the committed ledger (keyed `golden-1:<path>#<name>`) must be at rung example or better. */
async function ledgerItemsProven(): Promise<boolean> {
  const raw: unknown = JSON.parse(await readFile(join(root, "tooling", "ledger", "ledger.json"), "utf8"));
  const list = isRecord(raw) && Array.isArray(raw.exports) ? raw.exports : [];
  const mine = list.filter((e) => isRecord(e) && e.pkg === "golden-1");
  return mine.length > 0 && mine.every((e) => isRecord(e) && typeof e.rung === "string" && e.rung !== "none");
}

export default async (): Promise<boolean> => {
  for (const f of FILES) if (!(await exists(join(app, f)))) return false;

  const files = await codeFiles();
  const read = async (f: string): Promise<string> => readFile(join(app, f), "utf8");
  const tests = files.filter((f) => f.startsWith("test/"));
  const sources = files.filter((f) => !f.startsWith("test/"));
  const testText = (await Promise.all(tests.map(read))).join("\n");

  // Unsafe count 0 anywhere in the app.
  for (const f of files) if ((await read(f)).includes("unsafe(")) return false;

  // Invariant declared beside the store; properties for every transaction and the two components.
  if (!(await read(`${mod}/board.ts`)).includes("invariant(")) return false;
  if (!testText.includes("@keel/testing")) return false;
  for (const t of PROPERTY_TARGETS) if (!new RegExp(`\\bproperties\\(\\s*${t}\\b`).test(testText)) return false;

  const check = await sh("pnpm", ["check", "--quiet"]);
  if (!check.ok || tokens(check.stdout) > (await outputBudget("check.injected10"))) return false;
  const test = await sh("pnpm", ["test", "--quiet", "--filter", "golden-1"]);
  if (!test.ok || tokens(test.stdout) > (await outputBudget("test.failing3"))) return false;
  if (!(await sh("pnpm", ["ledger", "--diff", "--scope", "golden-1:"])).ok) return false;
  return ledgerItemsProven();
};
