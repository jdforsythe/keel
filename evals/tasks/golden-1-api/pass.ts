// True when golden app 1 meets evals/tasks/golden-1-api/TASK.md acceptance: files exist, check and tests green,
// properties cover transactions and components, every golden-1 ledger item at rung example or better, ledger not regressed,
// unsafe count 0, build green, quiet output within budgets, the hidden suite (acceptance.test.ts, copied into the app,
// run, and removed: the split proof, the race proof and the correctness checks), the planted-race twin (a sibling copy
// of the app whose `api.editTodo` rebases, where the same race scenario must find exactly one race), the rungs of the
// golden-1 ledger, the correctness twins (an invariant, two chart and a schedule twin, each a sibling copy with one
// planted change), the proof twins (an `addTodo` without its duplicate check, `api.purgeList` given to `prove`), the
// stored-data twin (`TodoList.hidden` made required: E1563 under `--base`), and the built processes (splitBuilt.ts,
// restartBuilt.ts).
import { execFile } from "node:child_process";
import { access, copyFile, cp, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { restartBuilt } from "./restartBuilt.ts";
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
  ...["board", "boardStores", "addList", "addTodo", "toggleTodo", "editTodo"].map((n) => `${api}/${n}.ts`),
  `${api}/TodoIdParams.schema.ts`,
  ...["TodoList", "Todo", "Board", "BoardView", "ListDraft", "TodoDraft", "Suggestion", "ListParams"].map(
    (n) => `${api}/${n}.schema.ts`,
  ),
  ...["loadBoard", "loadSuggestions", "postList", "postTodo", "postEdit", "postToggle", "postUndo"].map(
    (n) => `${api}/${n}.server.ts`,
  ),
  ...["boardChannel"].map((n) => `${api}/${n}.ts`),
  ...["boardEvents"].map((n) => `${api}/${n}.server.ts`),
  ...["ListWrite", "TodoWrite", "ToggleWrite"].map((n) => `${api}/${n}.schema.ts`),
  ...[
    "module",
    "routes",
    "editable.guard",
    "view",
    "hydrate",
    "refreshView",
    "todosApi",
    "boardOutbox",
    "formAnswer",
    "pageOrigin",
  ].map((n) => `${mod}/${n}.ts`),
  ...["todos", "suggestions", "boardWrites"].map((n) => `${mod}/${n}.service.ts`),
  ...["FieldsReply", "ListSearch", "TodoParams", "WriteAnswer", "WriteRefusal"].map((n) => `${mod}/${n}.schema.ts`),
  ...["loadIndex", "loadList", "loadTodo", "createList", "createTodo", "updateTodo"].map(
    (n) => `${mod}/${n}.server.ts`,
  ),
  ...["AppShell", "ListsPage", "ListPage", "TodoRow", "EditTodoPage", "ListError", "Suggestions", "OutboxPanel"].map(
    (n) => `${mod}/${n}.tsx`,
  ),
  ...[
    "module",
    "routes",
    "Digest.schema",
    "RecountInput.schema",
    "board.service",
    "boardApi",
    "LATEST_KEY",
    "readLatest",
    "writeLatest",
  ].map((n) => `${digest}/${n}.ts`),
  ...["recount", "jobs", "schedules", "runners", "loadDigest", "feedDigest", "refresh"].map(
    (n) => `${digest}/${n}.server.ts`,
  ),
  `${mod}/EditorData.schema.ts`,
  `${mod}/editorChart.ts`,
  `${api}/runners.server.ts`,
  ...["hideList", "showList", "purgeList", "removalChart"].map((n) => `${api}/${n}.ts`),
  ...["RemovalData", "StepFailure", "Removal", "FlowParams"].map((n) => `${api}/${n}.schema.ts`),
  ...["removal", "purge", "restore", "jobs", "removalStores", "postRemove", "postUndoRemoval"].map(
    (n) => `${api}/${n}.server.ts`,
  ),
  "deploy/web/capacitor/capacitor.config.json",
  ...["tauri.conf.json", "Cargo.toml", "build.rs", "src/main.rs", "src/lib.rs", "capabilities/default.json"].map(
    (n) => `deploy/web/tauri/${n}`,
  ),
  ...["api", "board", "components", "routes", "digest", "realtime"].map((n) => `test/${n}.test.ts`),
  ...["editorChart", "board.explore", "outbox.sim"].map((n) => `test/${n}.test.ts`),
  ...["board.prove", "removal", "removalChart.explore", "serverSqlite"].map((n) => `test/${n}.test.ts`),
  "test/simApi.ts",
  "test/apiRoutes.ts",
  "test/user.ts",
];
/** No file the realtime board replaced may remain. */
const GONE: readonly string[] = [`${mod}/syncAfter.ts`];
const PROPERTY_TARGETS: readonly string[] = [
  "addList",
  "addTodo",
  "toggleTodo",
  "editTodo",
  "hideList",
  "showList",
  "hydrate",
  "TodoRow",
  "Suggestions",
  "OutboxPanel",
];
const SKIP_DIR = /(^|\/)(node_modules|\.keel|dist|coverage)(\/|$)/;
const CODE = /\.(ts|tsx|mts|mjs|js)$/;

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

/** The `keel ledger --scope golden-1: --format=json` lines, computed now (not read from the committed ledger.json). */
async function ledgerLines(): Promise<unknown[]> {
  const r = await sh("node", [
    join(root, "packages", "cli", "src", "bin.ts"),
    "ledger",
    "--format=json",
    "--scope",
    "golden-1:",
  ]);
  return r.stdout
    .split("\n")
    .filter((l) => l.startsWith("{"))
    .map((l): unknown => JSON.parse(l));
}

/** Every golden-1 ledger item must be at rung example or better. */
async function ledgerItemsProven(): Promise<boolean> {
  const items = (await ledgerLines()).filter((e) => isRecord(e) && e.kind === "ledger");
  return items.length > 0 && items.every((e) => isRecord(e) && typeof e.rung === "string" && e.rung !== "none");
}

/** Items that must hold a rung, by the machinery behind it (k.model, k.prove, k.sim). */
const RUNG_OF: Readonly<Record<string, string>> = {
  "golden-1:todos/editorChart.ts#editorChart": "proven",
  "golden-1:api/removalChart.ts#removalChart": "proven",
  "golden-1:api/addList.ts#addList": "proven",
  "golden-1:api/addTodo.ts#addTodo": "proven",
  "golden-1:api/toggleTodo.ts#toggleTodo": "proven",
  "golden-1:api/editTodo.ts#editTodo": "proven",
  "golden-1:api/hideList.ts#hideList": "proven",
  "golden-1:api/showList.ts#showList": "proven",
  "golden-1:todos/boardOutbox.ts#boardOutbox": "probabilistic",
};

/**
 * The summary's rung counts hold `proven`, `probabilistic` and `example` at 1 or more, with the items
 * above at their rungs; `monitored` too when the app ships `.keel/monitored.json` (a fresh build has no production).
 * With that file, `keel ledger --diff` reports no E1712; once the committed ledger counts `monitored` items, moving the
 * file aside makes it report E1712 (a rung the file counts that no item holds). The file is put back.
 */
async function rungs(): Promise<string | undefined> {
  const lines = await ledgerLines();
  const summary = lines.find((e) => isRecord(e) && e.kind === "summary");
  const counts = isRecord(summary) && isRecord(summary.counts) ? summary.counts : {};
  const monitoredFile = join(app, ".keel", "monitored.json");
  const shipped = await exists(monitoredFile);
  const want = ["proven", "probabilistic", "example", ...(shipped ? ["monitored"] : [])];
  for (const r of want) if (!(typeof counts[r] === "number" && counts[r] >= 1)) return `rung ${r} holds no item`;
  for (const [item, rung] of Object.entries(RUNG_OF)) {
    const rec = lines.find((e) => isRecord(e) && e.kind === "ledger" && e.item === item);
    if (!isRecord(rec) || rec.rung !== rung)
      return `${item} is at ${isRecord(rec) ? String(rec.rung) : "none"}, not ${rung}`;
  }
  if (!shipped) return undefined;
  const committed: unknown = JSON.parse(await readFile(join(root, "tooling", "ledger", "ledger.json"), "utf8"));
  const counted = isRecord(committed) && isRecord(committed.rungs) ? committed.rungs.monitored : 0;
  const diff = () => sh("node", [join(root, "packages", "cli", "src", "bin.ts"), "ledger", "--diff"]);
  if ((await diff()).stdout.includes("E1712")) return "ledger --diff reports E1712 with .keel/monitored.json";
  if (!(typeof counted === "number" && counted > 0)) return undefined;
  const aside = `${monitoredFile}.aside`;
  await rename(monitoredFile, aside);
  try {
    if (!(await diff()).stdout.includes("E1712")) return "ledger --diff reports no E1712 without .keel/monitored.json";
  } finally {
    await rename(aside, monitoredFile);
  }
  return undefined;
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

/** What a twin copy leaves out; its `node_modules` is a link to the app's. */
const TWIN_SKIP: ReadonlySet<string> = new Set(["node_modules", "dist", ".keel", ".turbo"]);
const vitest = join(root, "node_modules", ".bin", "vitest");
const keelBin = join(root, "packages", "cli", "src", "bin.ts");

/**
 * A sibling copy of the app (so tsconfig, `node_modules` and the workspace paths resolve as for the app) with `plant`
 * applied to the text of `file`, the hidden suite copied in; `check` runs in it, and the copy is removed. A plant
 * that changes nothing fails the twin.
 */
async function twin(file: string, plant: (src: string) => string, check: (dir: string) => Promise<boolean>) {
  const dir = await mkdtemp(join(root, "apps", ".golden-1-twin-"));
  try {
    await cp(app, dir, { recursive: true, filter: (src) => !TWIN_SKIP.has(basename(src)) });
    await symlink(join(app, "node_modules"), join(dir, "node_modules"));
    const path = join(dir, file);
    const src = await readFile(path, "utf8");
    const planted = plant(src);
    if (planted === src) return false;
    await writeFile(path, planted);
    await copyFile(join(here, "acceptance.test.ts"), join(dir, ACCEPT));
    return await check(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** The hidden suite's tests named `name`, run in `dir` with `KEEL_TWIN` set to `kind`. */
const hidden = async (dir: string, name: string, kind = ""): Promise<boolean> =>
  (await sh(vitest, ["run", ACCEPT, "-t", name], dir, kind === "" ? {} : { KEEL_TWIN: kind })).ok;
/** Whether the app's own test `file` passes in `dir`. */
const own = async (dir: string, file: string): Promise<boolean> => (await sh(vitest, ["run", file], dir)).ok;

/**
 * The planted-race twin: `api.editTodo` declares `{ concurrent: 'rebase' }`, a full-field edit declared safe on any
 * state. The hidden suite's race scenario runs there and must find exactly the one race.
 */
const plantedTwin = (): Promise<boolean> =>
  twin(
    `${api}/editTodo.ts`,
    (src) => src.replace(/,?\s*\);\s*$/, ', { concurrent: "rebase" });\n'),
    (dir) => hidden(dir, "golden-1 race"),
  );

/** The object literal that follows `key:` in `src` (balanced braces), as [start, end) offsets, else undefined. */
function objectAfter(src: string, key: string): [number, number] | undefined {
  const at = src.search(new RegExp(`\\b${key}:\\s*\\{`));
  if (at < 0) return undefined;
  const open = src.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return [at, i + 1];
  }
  return undefined;
}

/**
 * The correctness twins, each a copy with one planted change:
 * - invariant: `addTodo` drops its duplicate-id test. `board.explore.test.ts` fails, and the hidden suite finds E1708
 *   at an empty path whose `restore` and `tx` return `store.invariant`.
 * - chart-theirs: `conflict` loses its `theirs` target. `keel check` stays clean (`mine` still leads to `saving`) and
 *   `coverage` reports `dead: ['conflict']`.
 * - chart-exits: `conflict` loses every exit. `keel check` reports E2753 with the `final: true` fix.
 * - schedule: `postToggle` drops `...w.value`, the write key and base passed to its transaction. `outbox.sim.test.ts` fails, and the hidden suite finds E1704 shrunk
 *   to one `lost` step, replayed alike and printed byte-equal twice.
 */
async function correctnessTwins(): Promise<string | undefined> {
  const invariant = await twin(
    `${api}/addTodo.ts`,
    (src) => src.replace(/state\.todos\.some\(\(?(\w+)\)? => \1\.id === (\w+)\.id\)\s*\|\|\s*/, ""),
    async (dir) =>
      !(await own(dir, "test/board.explore.test.ts")) && (await hidden(dir, "golden-1 twins", "invariant")),
  );
  if (!invariant) return "invariant twin";
  const theirs = await twin(
    `${mod}/editorChart.ts`,
    (src) => {
      const span = objectAfter(src, "conflict");
      if (span === undefined) return src;
      const body = src.slice(span[0], span[1]).replace(/,?\s*theirs:\s*(\{[^{}]*\}|"[^"]*")/, "");
      return src.slice(0, span[0]) + body + src.slice(span[1]);
    },
    async (dir) =>
      (await sh("node", [keelBin, "build"], dir)).ok &&
      (await sh("node", [keelBin, "check", "--quiet"], dir)).ok &&
      (await hidden(dir, "golden-1 twins", "chart-theirs")),
  );
  if (!theirs) return "chart twin (theirs removed)";
  const exits = await twin(
    `${mod}/editorChart.ts`,
    (src) => {
      const span = objectAfter(src, "conflict");
      return span === undefined ? src : `${src.slice(0, span[0])}conflict: {}${src.slice(span[1])}`;
    },
    async (dir) => {
      const r = await sh("node", [keelBin, "check"], dir);
      return !r.ok && /E2753 modules\/todos\/editorChart\.ts/.test(r.stdout) && r.stdout.includes("final: true");
    },
  );
  if (!exits) return "chart twin (exits removed)";
  const schedule = await twin(
    `${api}/postToggle.server.ts`,
    (src) => src.replace(/,\s*\.\.\.w\.value\b/, ""),
    async (dir) => !(await own(dir, "test/outbox.sim.test.ts")) && (await hidden(dir, "golden-1 twins", "schedule")),
  );
  if (!schedule) return "schedule twin";
  return undefined;
}

/**
 * The proof twins (k.prove), each a copy with one planted change, and the stored-data twin (k.compat):
 * - duplicate: `addTodo` drops its duplicate-id test. `board.prove.test.ts` fails with E1716.
 * - fragment: `api.purgeList` joins the `prove` list. `board.prove.test.ts` fails with E1715 naming `.filter`.
 * - required: `TodoList.hidden` loses `.optional()`. `keel check --base` the app's shipped `.keel/surface.json` is one
 *   E1563 at `lists.[].hidden`.
 */
export async function proofTwins(): Promise<string | undefined> {
  const failing = async (dir: string, code: RegExp): Promise<boolean> => {
    const r = await sh(vitest, ["run", "test/board.prove.test.ts"], dir);
    return !r.ok && code.test(r.stdout);
  };
  const duplicate = await twin(
    `${api}/addTodo.ts`,
    (src) => src.replace(/state\.todos\.some\(\(?(\w+)\)? => \1\.id === (\w+)\.id\)\s*\|\|\s*/, ""),
    (dir) => failing(dir, /E1716/),
  );
  if (!duplicate) return "proof twin (duplicate check removed)";
  const fragment = await twin(
    "test/board.prove.test.ts",
    (src) =>
      src
        .replace("hideList(b), showList(b)]", "hideList(b), showList(b), purgeList(b)]")
        .replace(
          'import { showList } from "../modules/api/showList.ts";',
          'import { purgeList } from "../modules/api/purgeList.ts";\nimport { showList } from "../modules/api/showList.ts";',
        ),
    (dir) => failing(dir, /E1715[^\n]*filter/),
  );
  if (!fragment) return "proof twin (purgeList proved)";
  const shipped = join(app, ".keel", "surface.json");
  const required = await twin(
    `${api}/TodoList.schema.ts`,
    (src) => src.replace("hidden: s.boolean().optional()", "hidden: s.boolean()"),
    async (dir) => {
      if (!(await sh("node", [keelBin, "build"], dir)).ok) return false;
      const r = await sh("node", [keelBin, "check", "--base", shipped], dir);
      const e1563 = r.stdout.match(/^E1563 [^\n]*/gm) ?? [];
      return !r.ok && e1563.length === 1 && (e1563[0] ?? "").includes("lists.[].hidden");
    },
  );
  if (!required) return "stored-data twin (hidden required)";
  return undefined;
}

export default async (): Promise<boolean> => {
  for (const f of FILES) if (!(await exists(join(app, f)))) return false;
  for (const f of GONE) if (await exists(join(app, f))) return false;
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
  const held = await rungs();
  if (held !== undefined) process.stderr.write(`V0001 evals/tasks/golden-1-api/pass.ts ${held}\n`);
  if (held !== undefined) return false;
  if (!(await acceptance())) return false;
  if (!(await plantedTwin())) return false;
  const twins = await correctnessTwins();
  if (twins !== undefined)
    process.stderr.write(`V0001 evals/tasks/golden-1-api/pass.ts ${twins} did not fail as planted\n`);
  if (twins !== undefined) return false;
  const proofs = await proofTwins();
  if (proofs !== undefined)
    process.stderr.write(`V0001 evals/tasks/golden-1-api/pass.ts ${proofs} did not fail as planted\n`);
  if (proofs !== undefined) return false;
  const split = await splitBuilt(root);
  if (split !== undefined) process.stderr.write(`V0001 evals/tasks/golden-1-api/splitBuilt.ts ${split}\n`);
  if (split !== undefined) return false;
  const restart = await restartBuilt(root);
  if (restart !== undefined) process.stderr.write(`V0001 evals/tasks/golden-1-api/restartBuilt.ts ${restart}\n`);
  return restart === undefined;
};
