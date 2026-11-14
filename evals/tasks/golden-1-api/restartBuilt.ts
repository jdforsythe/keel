// The built restart proof of golden-1 on std-db: a copy of apps/golden-1 built with `keel build`, its
// `dist/api/server.mjs` served on a SQLite file in a temporary folder (and on Postgres when `KEEL_TEST_POSTGRES_URL`
// names a server: a copy whose topology says `storage: 'postgres'`), driven over HTTP, killed with SIGKILL and
// restarted: the stored board row is byte-equal, GET answers the same board, and the next write's entry is one higher.
// Then the migration twin: a copy without `api.editTodo` serves the same SQLite file, restores the board with `state`
// and `head` equal, and its next save keeps an empty log before that write. Returns undefined when every step holds,
// else the failed steps on one line.
import { type ChildProcess, execFile, spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";

const SECRET = "golden-1-restart-proof-secret-of-32-bytes-or-more";
const BOARD_KEY = "keel.store.api.board";
const SKIP = new Set(["node_modules", "dist", ".keel", ".keel-dev", ".turbo", "reports"]);

type Run = { ok: boolean; stdout: string };
const sh = (cmd: string, args: string[], cwd: string): Promise<Run> =>
  new Promise((resolve) => {
    execFile(cmd, args, { cwd, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, KEEL_AGENT: "1" } }, (e, out) =>
      resolve({ ok: e === null, stdout: String(out) }),
    );
  });

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const a = s.address();
      const port = typeof a === "object" && a !== null ? a.port : 0;
      s.close(() => resolve(port));
    });
  });

type Proc = { child: ChildProcess; exited: Promise<number | null> };
function serve(copy: string, port: number, url: string): Proc {
  const child = spawn(
    process.execPath,
    ["--disable-warning=ExperimentalWarning", join(copy, "dist", "api", "server.mjs")],
    {
      cwd: copy,
      env: { ...process.env, PORT: String(port), KEEL_SECRET: SECRET, KEEL_DATABASE_URL: url },
      stdio: "ignore",
    },
  );
  const exited = new Promise<number | null>((resolve) => child.once("exit", (code) => resolve(code)));
  return { child, exited };
}

async function ready(base: string): Promise<boolean> {
  for (let i = 0; i < 100; i++) {
    const s = await fetch(`${base}/api/lists`, { headers: { accept: "application/json" } }).then(
      (r) => r.status,
      () => 0,
    );
    if (s === 200) return true;
    await sleep(100);
  }
  return false;
}

/** The `id` of each entry of a snapshot's `log`. */
const entryIds = (snap: unknown): number[] => {
  const log = field(snap, "log");
  return Array.isArray(log) ? log.map((e: unknown) => Number(field(e, "id"))) : [];
};
const field = (v: unknown, ...keys: string[]): unknown =>
  keys.reduce<unknown>((o, k) => (typeof o === "object" && o !== null ? Reflect.get(o, k) : undefined), v);

/** The S4 HTTP script's writes: a list, two todos, a toggle and an edit; each with its own key. */
async function script(base: string, run: string): Promise<void> {
  const headers = { accept: "application/json", "content-type": "application/json", "x-keel": "1" };
  let keys = 0;
  const post = (path: string, body: unknown) =>
    fetch(`${base}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  const write = () => ({ key: `${run}${++keys}`, base: 0 });
  await post("/api/lists", { name: "Home", write: write() });
  const lists = await board(base);
  const listId = String(field(lists, "lists", "0", "id"));
  for (const title of ["Milk", "Eggs"])
    await post(`/api/lists/${listId}/todos`, { title, priority: "normal", write: write() });
  const todo = String(field(await board(base), "todos", "1", "id"));
  await post(`/api/todos/${todo}/toggle`, { write: write() });
  // An edit refuses a stale base: it names the head just read.
  const head = Number(field(await board(base), "head"));
  await post(`/api/todos/${todo}`, {
    title: `Oat milk ${keys}`,
    priority: "high",
    write: { key: `${run}${++keys}`, base: head },
  });
}

const board = async (base: string): Promise<unknown> =>
  field(
    await fetch(`${base}/api/lists`, { headers: { accept: "application/json" } })
      .then((r) => r.json())
      .catch(() => null),
    "results",
    "api.lists",
    "value",
  );

/** The stored `api.board` row, read from the database as it is on disk. */
type Reader = () => Promise<string | undefined>;
const sqliteRow =
  (file: string): Reader =>
  async () => {
    const db = new DatabaseSync(file, { readOnly: true });
    try {
      const row = db.prepare("SELECT value FROM keel_kv WHERE key = ?").get(BOARD_KEY);
      return typeof row?.value === "string" ? row.value : undefined;
    } finally {
      db.close();
    }
  };

async function copyApp(app: string, tmp: string, name: string): Promise<string> {
  const to = join(tmp, name);
  await cp(app, to, { recursive: true, filter: (src) => src === app || !SKIP.has(basename(src)) });
  await symlink(join(app, "node_modules"), join(to, "node_modules"), "dir");
  return to;
}

/** One restart run of `copy` on `url`: script, SIGKILL, restart; the failed steps are pushed to `failed`. */
async function restart(copy: string, url: string, row: Reader, label: string, failed: string[]): Promise<string> {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const first = serve(copy, port, url);
  let kept = "";
  try {
    if (!(await ready(base))) {
      failed.push(`${label}: server did not answer`);
      return "";
    }
    await script(base, "a");
    const before = await row();
    const view = JSON.stringify(await board(base));
    first.child.kill("SIGKILL");
    await first.exited;
    const second = serve(copy, port, url);
    try {
      if (!(await ready(base))) failed.push(`${label}: restarted server did not answer`);
      const after = await row();
      if (before === undefined || before !== after) failed.push(`${label}: stored row differs after SIGKILL`);
      if (JSON.stringify(await board(base)) !== view) failed.push(`${label}: GET /api/lists differs after restart`);
      const snap: unknown = JSON.parse(after ?? "{}");
      const head = Number(field(snap, "head"));
      const ids = entryIds(snap);
      await script(base, "b");
      const next: unknown = JSON.parse((await row()) ?? "{}");
      const nextIds = entryIds(next);
      if (Number(field(next, "head")) <= head || nextIds.find((i) => !ids.includes(i)) !== head + 1)
        failed.push(`${label}: the next write's entry is not ${head + 1}`);
      kept = (await row()) ?? "";
      second.child.kill("SIGTERM");
      if ((await second.exited) !== 0) failed.push(`${label}: SIGTERM did not exit 0`);
    } finally {
      second.child.kill("SIGKILL");
    }
  } finally {
    first.child.kill("SIGKILL");
  }
  return kept;
}

export async function restartBuilt(root: string): Promise<string | undefined> {
  const app = join(root, "apps", "golden-1");
  const cli = join(root, "packages", "cli", "src", "bin.ts");
  await mkdir(join(root, ".fixtures"), { recursive: true });
  const tmp = await mkdtemp(join(root, ".fixtures", "golden-1-restart-"));
  // The databases live outside the repo tree.
  const data = await mkdtemp(join(tmpdir(), "golden-1-restart-db-"));
  const failed: string[] = [];
  try {
    const a = await copyApp(app, tmp, "a");
    if (!(await sh(process.execPath, [cli, "build"], a)).ok) return "keel build failed";
    const file = join(data, "keel.sqlite");
    const kept = await restart(a, pathToFileURL(file).href, sqliteRow(file), "sqlite", failed);

    // Migration twin: `api.editTodo` renamed, so the stored log's edit names a transaction the board no longer
    // declares (W1564 under `--base`); the restarted process restores the stored board with state and head equal and
    // keeps no entry of the log it cannot replay.
    const b = await copyApp(app, tmp, "b");
    const editFile = join(b, "modules", "api", "editTodo.ts");
    const src = await readFile(editFile, "utf8");
    const planted = src.replace('"api.editTodo"', '"api.reviseTodo"');
    if (planted === src) failed.push("twin: api.editTodo not renamed");
    await writeFile(editFile, planted);
    const built = await sh(process.execPath, [cli, "build"], b);
    const base = await sh(process.execPath, [cli, "check", "--base", join(a, ".keel", "surface.json")], b);
    if (!/W1564 [^\n]*api\.editTodo/.test(base.stdout))
      failed.push("twin: keel check --base reports no W1564 for api.editTodo");
    if (built.ok) {
      const port = await freePort();
      const p = serve(b, port, pathToFileURL(file).href);
      try {
        const url = `http://127.0.0.1:${port}`;
        if (!(await ready(url))) failed.push("twin: server did not answer");
        const shown: unknown = await board(url);
        const was: unknown = JSON.parse(kept || "{}");
        if (JSON.stringify(field(shown, "lists")) !== JSON.stringify(field(was, "state", "lists")))
          failed.push("twin: restored state differs");
        if (field(shown, "head") !== field(was, "head")) failed.push("twin: restored head differs");
        const todo = String(field(was, "state", "todos", "0", "id"));
        await fetch(`${url}/api/todos/${todo}/toggle`, {
          method: "POST",
          headers: { accept: "application/json", "content-type": "application/json", "x-keel": "1" },
          body: JSON.stringify({ write: { key: "twin1", base: 0 } }),
        });
        const saved: unknown = JSON.parse((await sqliteRow(file)()) ?? "{}");
        const log = field(saved, "log");
        if (!Array.isArray(log) || log.length !== 1)
          failed.push("twin: the folded log is not empty before the new write");
      } finally {
        p.child.kill("SIGKILL");
      }
    } else failed.push("twin: keel build failed");

    // Postgres, when a server is given (CI's service container).
    const pgUrl = process.env.KEEL_TEST_POSTGRES_URL;
    if (pgUrl !== undefined && pgUrl !== "") {
      const c = await copyApp(app, tmp, "c");
      const topo = join(c, "topology.ts");
      await writeFile(topo, (await readFile(topo, "utf8")).replace('storage: "sqlite"', 'storage: "postgres"'));
      if (!(await sh(process.execPath, [cli, "build"], c)).ok) failed.push("postgres: keel build failed");
      else {
        const req = createRequire(join(root, "packages", "std-db", "package.json"));
        const pg: { Client: new (o: { connectionString: string }) => PgClient } = req("pg");
        const client = new pg.Client({ connectionString: pgUrl });
        await client.connect();
        try {
          await client.query("DROP TABLE IF EXISTS keel_kv, keel_meta");
          const row: Reader = async () => {
            const r = await client.query("SELECT value FROM keel_kv WHERE key = $1", [BOARD_KEY]);
            const v: unknown = r.rows[0]?.value;
            return typeof v === "string" ? v : undefined;
          };
          await restart(c, pgUrl, row, "postgres", failed);
        } finally {
          await client.end();
        }
      }
    }
    return failed.length === 0 ? undefined : failed.join("; ");
  } catch (e) {
    return `restart proof threw: ${e instanceof Error ? e.message : String(e)}`;
  } finally {
    await rm(tmp, { recursive: true, force: true });
    await rm(data, { recursive: true, force: true });
  }
}

type PgClient = {
  connect(): Promise<void>;
  query(text: string, values?: unknown[]): Promise<{ rows: { value?: unknown }[] }>;
  end(): Promise<void>;
};
