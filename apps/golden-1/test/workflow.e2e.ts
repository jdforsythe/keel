// Crash proof for golden-1's removal workflow, built: a copy of the app whose `restore` step waits 2,000 ms on
// `ctx.clock` with `timeoutMs: 3000`. A list is removed and undone, the api is killed with SIGKILL while the stored
// instance shows its step running (`attempt` 1), and started again on the same data: within the bound the instance is
// `kept` and the list is visible once. Once on SQLite (the topology's storage), once on Postgres 17 (a database of the run's own on the server `KEEL_TEST_POSTGRES_URL` names).
import { randomUUID } from "node:crypto";
import { cp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { store } from "@keel/store";
import { type Served, build, serve } from "@keel/testing/e2e";
import { fixedTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import pg from "pg";
import { expect, it } from "vitest";
import { Board } from "../modules/api/Board.schema.ts";

const here = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["node_modules", "dist", ".keel", ".keel-dev", ".turbo", "reports", ".api.storage"]);

// The api's stores, named for `state`: ids and schemas, made in a detached root of the file's own.
const Instance = s.object({
  state: s.string(),
  data: s.object({ list: s.string().optional() }),
  entered: s.int({ min: 0 }),
  attempt: s.int({ min: 0 }),
});
const [board, removal] = scope(() => undefined, { detached: true }).run(() => [
  store(Board, { lists: [], todos: [] }, { id: "api.board" }),
  store(s.object({ instances: s.record(Instance) }), { instances: {} }, { id: "api.removal" }),
]);

const headers = { accept: "application/json", "content-type": "application/json", "x-keel": "1" };

/** The field at `keys` of `value`, `undefined` where a step is not an object. */
function field(value: unknown, ...keys: string[]): unknown {
  return keys.reduce<unknown>((o, k) => (typeof o === "object" && o !== null ? Reflect.get(o, k) : undefined), value);
}

/** The `api.lists` value of `GET /api/lists`. */
async function view(app: Served): Promise<unknown> {
  const body: unknown = await (await app.fetch("/api/lists", { headers: { accept: "application/json" } })).json();
  return field(body, "results", "api.lists", "value");
}

/**
 * A database of this run's own on the server `url` names, so a run reads only its own instances and logs; dropped at
 * the end (its connections closed with it).
 */
async function freshDatabase(url: string): Promise<{ url: string; drop: () => Promise<void> }> {
  const name = `keel_e2e_${randomUUID().replaceAll("-", "")}`;
  const admin = async (sql: string): Promise<void> => {
    const c = new pg.Client({ connectionString: url });
    await c.connect();
    try {
      await c.query(sql);
    } finally {
      await c.end();
    }
  };
  await admin(`CREATE DATABASE ${name}`);
  const at = new URL(url);
  at.pathname = `/${name}`;
  return { url: at.href, drop: () => admin(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`) };
}

/** A copy of the app in a temporary folder with the planted step (and `postgres` storage when asked), not yet built. */
async function plantedCopy(onPostgres: boolean): Promise<string> {
  const tmp = tempDir("keel-e2e-workflow-");
  const dir = join(tmp, "app");
  // No `test/`: the copy is built alone, and vitest resolves from the workspace root, not from the copy.
  await cp(here, dir, {
    recursive: true,
    filter: (src) => src === here || (src !== join(here, "test") && !SKIP.has(basename(src))),
  });
  await symlink(join(here, "node_modules"), join(dir, "node_modules"), "dir");
  const edit = async (file: string, from: string, to: string): Promise<void> => {
    const text = await readFile(file, "utf8");
    const next = text.replace(from, to);
    if (next === text) throw new Error(`${file} has no ${from}`);
    await writeFile(file, next);
  };
  // The copy's `restore` waits 2,000 ms on the clock, and its step times out at 3,000 ms.
  await edit(
    join(dir, "modules", "api", "restore.server.ts"),
    "if (id === undefined) return ok({});",
    "if (id === undefined) return ok({});\n  await ctx.clock.after(2000);",
  );
  await edit(
    join(dir, "modules", "api", "removal.server.ts"),
    "restoring: { run: restore,",
    "restoring: { run: restore, timeoutMs: 3000,",
  );
  if (onPostgres) await edit(join(dir, "topology.ts"), 'storage: "sqlite"', 'storage: "postgres"');
  return tmp;
}

/** Remove a list, undo it, kill the api inside the step, restart it: the instance ends `kept`, the list shows once. */
async function crashInsideStep(app: Served): Promise<void> {
  const post = async (path: string, body: unknown): Promise<number> =>
    (await app.fetch(path, { method: "POST", headers, body: JSON.stringify(body) })).status;

  // A list, removed and then undone: `restoring` runs the step.
  expect(await post("/api/lists", { name: "Home", write: { key: "w1", base: 0, owner: "" } })).toBe(200);
  const listId = String(field(await view(app), "lists", "0", "id"));
  expect(await post(`/api/lists/${listId}/remove`, {})).toBe(200);
  const flow = String(field(await view(app), "removals", "0", "flow"));
  expect(await post(`/api/removals/${flow}/undo`, {})).toBe(200);
  await app.until(removal, (r) => Object.values(r.instances).some((i) => i.state === "restoring" && i.attempt === 1));

  // The step is mid-wait (2,000 ms): the process dies inside it.
  await app.stop();
  const mid = Object.values((await app.state(removal)).instances);
  expect(mid).toHaveLength(1);
  expect(mid.every((i) => i.state === "restoring")).toBe(true);
  expect((await app.log(removal)).entries.map((e) => e.name)).not.toContain("api.removal.restored");

  await app.start();
  // The resumed step waits its own 2,000 ms: an input of the app (`fixed`), and the smoke's bound of 10 s from the
  // restart holds: 5 s of app time and 5 s the test chose. A step retried after a longer back-off fails here.
  await app.until(
    removal,
    (r) => {
      const rows = Object.values(r.instances);
      return rows.length === 1 && rows.every((i) => i.state === "kept");
    },
    { fixed: fixedTime(5_000), within: 5_000 },
  );
  // The step ran twice (the killed run and the resumed one) and its restore is recorded once.
  const names = (await app.log(removal)).entries.map((e) => e.name);
  expect(names.filter((n) => n === "api.removal.attempt")).toHaveLength(2);
  expect(names.filter((n) => n === "api.removal.restored")).toHaveLength(1);
  const shown = field(await view(app), "lists");
  expect(
    Array.isArray(shown) ? shown.filter((l) => field(l, "id") === listId && field(l, "hidden") !== true) : [],
  ).toHaveLength(1);
  const stored = await app.state(board);
  expect(stored.lists.filter((l) => l.id === listId && l.hidden !== true)).toHaveLength(1);
  // The step's effect is one `api.showList` commit on the board, however many times the step ran, and the board's log
  // rises by one up to its head.
  const log = await app.log(board);
  expect(log.entries.filter((e) => e.name === "api.showList")).toHaveLength(1);
  const ids = log.entries.map((e) => e.id);
  expect(ids.every((id, i) => i === 0 || id === (ids[i - 1] ?? 0) + 1)).toBe(true);
  expect(ids.at(-1)).toBe(log.head);
}

// The build of a copy and two server starts are the machine's own work, not a bound the test chose.
it(
  "a SIGKILL inside the restore step on SQLite: the restarted api ends the instance kept and the list visible once",
  { timeout: fixedTime(300_000) },
  async () => {
    const tmp = await plantedCopy(false);
    try {
      const dir = join(tmp, "app");
      await build(dir);
      const app = await serve({ project: dir });
      await crashInsideStep(app);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  },
);

it(
  "a SIGKILL inside the restore step on Postgres 17: the restarted api ends the instance kept and the list visible once",
  { timeout: fixedTime(300_000) },
  async () => {
    const url = process.env.KEEL_TEST_POSTGRES_URL ?? "";
    if (url === "") throw new Error("KEEL_TEST_POSTGRES_URL is not set: this test needs a Postgres 17 server");
    const tmp = await plantedCopy(true);
    const db = await freshDatabase(url);
    try {
      const dir = join(tmp, "app");
      await build(dir);
      const app = await serve({ project: dir, env: { KEEL_DATABASE_URL: db.url } });
      await crashInsideStep(app);
    } finally {
      await db.drop();
      await rm(tmp, { recursive: true, force: true });
    }
  },
);
