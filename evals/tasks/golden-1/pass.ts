// True when golden app 1 meets evals/tasks/golden-1/TASK.md acceptance: files exist, check and tests green,
// properties cover transactions and components, every export is test-referenced, ledger not regressed,
// unsafe count 0, quiet output within budgets.
import { execFile } from "node:child_process";
import { access, readFile, readdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
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
const LEDGER_EXEMPT_FILES: readonly string[] = ["module.ts", "routes.ts"];
const LEDGER_EXEMPT_NAMES: readonly string[] = ["Props", "uses"];
const SKIP_DIR = /(^|\/)(node_modules|\.keel|dist|coverage)(\/|$)/;
const CODE = /\.(ts|tsx|mts|mjs|js)$/;
const NAMED_EXPORT = /^export\s+(?:async\s+)?(?:const|let|function\*?|class)\s+([A-Za-z_$][\w$]*)/gm;
const DEFAULT_EXPORT = /^export\s+default\b/m;

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
const reEscape = (s: string): string => s.replace(/[$]/g, "\\$");

async function codeFiles(): Promise<string[]> {
  const all = await readdir(app, { recursive: true });
  return all
    .map((f) => f.split("\\").join("/"))
    .filter((f) => CODE.test(f) && !SKIP_DIR.test(f))
    .sort();
}

async function outputBudget(key: string): Promise<number> {
  const raw: unknown = JSON.parse(await readFile(join(root, "tooling", "budgets.json"), "utf8"));
  const output = isRecord(raw) ? raw.output : undefined;
  const v = isRecord(output) ? output[key] : undefined;
  return typeof v === "number" ? v : 0;
}

function exportsOf(file: string, src: string): string[] {
  const names = [...src.matchAll(NAMED_EXPORT)].map((m) => m[1] ?? "");
  if (DEFAULT_EXPORT.test(src)) names.push(basename(file).split(".")[0] ?? "");
  return names.filter((n) => n !== "" && !LEDGER_EXEMPT_NAMES.includes(n));
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

  // Ledger rung example or better: every export under modules/ is named in a test.
  for (const f of sources.filter((x) => x.startsWith("modules/"))) {
    if (LEDGER_EXEMPT_FILES.includes(basename(f))) continue;
    for (const name of exportsOf(f, await read(f))) {
      if (!new RegExp(`\\b${reEscape(name)}\\b`).test(testText)) return false;
    }
  }

  const check = await sh("pnpm", ["check", "--quiet"]);
  if (!check.ok || tokens(check.stdout) > (await outputBudget("check.injected10"))) return false;
  const test = await sh("pnpm", ["test", "--quiet", "--filter", "golden-1"]);
  if (!test.ok || tokens(test.stdout) > (await outputBudget("test.failing3"))) return false;
  return (await sh("node", ["tooling/ledger.mjs", "--diff", "--quiet"])).ok;
};
