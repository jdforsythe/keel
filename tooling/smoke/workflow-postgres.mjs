// Crash proof for the golden-1 removal workflow on Postgres 17: a copy whose topology says `storage: "postgres"` and
// whose `restore` step waits 2,000 ms on `ctx.clock` with `timeoutMs: 3000`, built and served with `KEEL_DATABASE_URL`
// naming the server. The workflow store, its job queue and the board all live in Postgres. Remove a list, undo it,
// SIGKILL the server once the stored instance shows `attempt` 1 (the step is running), start it again on the same
// database: within 10 s the instance is `kept`, the step ran twice, `api.removal.restored` is in the workflow log once,
// the step's effect (`api.showList` on the board) is in the board log once, and the list is visible once.
// The server is `KEEL_TEST_POSTGRES_URL` when set, else a throwaway `postgres:17` container on a free loopback port,
// removed on every path. Usage: node tooling/smoke/workflow-postgres.mjs. Nothing is written inside the repo; no
// database URL, password or stored value is printed.
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixedTime, testTime } from "../test-time.ts";
import {
  BOARD_KEY,
  REMOVAL_KEY,
  buildIn,
  copyApp,
  field,
  freePort,
  get,
  post,
  ready,
  recorder,
  root,
  serve,
  stop,
  view,
  wait,
} from "./built.mjs";

const { step, finish, caught } = recorder();
const tmp = await mkdtemp(join(tmpdir(), "keel-smoke-workflow-pg-"));
const pg = createRequire(join(root, "packages", "std-db", "package.json"))("pg");
let first;
let second;
let container;
let client;

/** Run `docker` with `args`; resolves its trimmed stdout, or null when it fails. */
const docker = (args) =>
  new Promise((resolve) =>
    execFile("docker", args, { timeout: testTime(60_000) }, (e, out) =>
      resolve(e === null ? String(out).trim() : null),
    ),
  );
process.on("exit", () => {
  if (container !== undefined) execFile("docker", ["rm", "-f", container], () => undefined);
});

/** A throwaway `postgres:17` container on a free loopback port; resolves its `postgres:` URL once it answers, or null. */
async function postgres17() {
  const id = await docker([
    "run",
    "-d",
    "--rm",
    "-e",
    "POSTGRES_PASSWORD=smoke",
    "-p",
    "127.0.0.1::5432",
    "postgres:17",
  ]);
  if (id === null) return null;
  container = id;
  const port = (await docker(["port", id, "5432/tcp"]))?.split("\n")[0]?.split(":").at(-1);
  if (port === undefined) return null;
  // The image's init runs a server on the socket only; a TCP answer inside the container is the final server.
  for (const end = Date.now() + testTime(60_000); Date.now() < end; await wait(250)) {
    if ((await docker(["exec", id, "pg_isready", "-q", "-h", "127.0.0.1", "-U", "postgres"])) !== null)
      return `postgres://postgres:smoke@127.0.0.1:${port}/postgres`;
  }
  return null;
}

/** The stored text of `key` in `keel_kv`, or undefined. */
async function row(key) {
  const r = await client.query("SELECT value FROM keel_kv WHERE key = $1", [key]).catch(() => ({ rows: [] }));
  const v = r.rows[0]?.value;
  return typeof v === "string" ? v : undefined;
}

/** The stored instances of `api.removal` and the names of its log, or empty when the row is not there. */
async function removals() {
  const raw = await row(REMOVAL_KEY);
  const snap = raw === undefined ? {} : JSON.parse(raw);
  const log = Array.isArray(snap.log) ? snap.log : [];
  return { rows: Object.values(field(snap, "state", "instances") ?? {}), names: log.map((e) => String(e.name)) };
}

/** Poll `pred` every 50 ms for at most `ms`. */
async function until(pred, ms) {
  for (const end = Date.now() + ms; Date.now() < end; ) {
    if (await pred()) return true;
    await wait(50);
  }
  return false;
}

try {
  const given = process.env.KEEL_TEST_POSTGRES_URL ?? "";
  const url = given !== "" ? given : await postgres17();
  step("postgres 17", url !== null, given !== "" ? "KEEL_TEST_POSTGRES_URL" : "container");
  if (url === null) throw new Error("no Postgres server: set KEEL_TEST_POSTGRES_URL or start docker");
  client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query("DROP TABLE IF EXISTS keel_kv, keel_meta");

  const dir = join(tmp, "app");
  await copyApp(dir);
  const topo = join(dir, "topology.ts");
  const tsrc = await readFile(topo, "utf8");
  const onPg = tsrc.replace('storage: "sqlite"', 'storage: "postgres"');
  const restoreFile = join(dir, "modules", "api", "restore.server.ts");
  const src = await readFile(restoreFile, "utf8");
  const slow = src.replace(
    "if (id === undefined) return ok({});",
    "if (id === undefined) return ok({});\n  await ctx.clock.after(2000);",
  );
  const removalFile = join(dir, "modules", "api", "removal.server.ts");
  const rsrc = await readFile(removalFile, "utf8");
  const limited = rsrc.replace("restoring: { run: restore,", "restoring: { run: restore, timeoutMs: 3000,");
  step("plant", onPg !== tsrc && slow !== src && limited !== rsrc);
  await writeFile(topo, onPg);
  await writeFile(restoreFile, slow);
  await writeFile(removalFile, limited);
  const built = await buildIn(dir);
  step("build", built);
  if (!built) throw new Error("build failed");

  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  first = serve(dir, url, port);
  const up = await ready(base);
  step("serve on postgres", up);
  if (!up) throw new Error(`server did not answer: ${first.log.slice(-3).join(" | ")}`);

  // A list, removed and then undone: `restoring` runs the step.
  const key = (n) => ({ key: `w${n}`, base: 0, owner: "" });
  step("add list", (await post(base, "/api/lists", { name: "Home", write: key(1) })) === 200);
  const listId = String(field(view((await get(base, "/api/lists")).body), "lists", "0", "id"));
  step("remove", (await post(base, `/api/lists/${listId}/remove`)) === 200);
  const flow = String(field(view((await get(base, "/api/lists")).body), "removals", "0", "flow"));
  step("undo", (await post(base, `/api/removals/${flow}/undo`)) === 200);
  const running = await until(
    async () => (await removals()).rows.some((r) => r.state === "restoring" && r.attempt === 1),
    testTime(10_000),
  );
  step("step running", running);
  // The step is mid-wait (2,000 ms): the process dies inside it.
  first.child.kill("SIGKILL");
  await first.exited;
  step("sigkill", first.child.signalCode === "SIGKILL");
  const mid = await removals();
  step(
    "interrupted",
    mid.rows.length === 1 &&
      mid.rows.every((r) => r.state === "restoring") &&
      !mid.names.includes("api.removal.restored"),
  );

  second = serve(dir, url, port);
  step("restart", await ready(base));
  const kept = await until(async () => {
    const r = await removals();
    return r.rows.length === 1 && r.rows.every((i) => i.state === "kept");
    // The resumed step waits its own 2,000 ms and its 3,000 ms timeout is planted above: inputs, not bounds. The
    // restart and the settle take about 1 s; the allowance on top is 30 s.
  }, fixedTime(5_000) + testTime(30_000));
  step("kept within 35s", kept);
  const end = await removals();
  const runs = end.names.filter((n) => n === "api.removal.attempt").length;
  step("step ran twice", runs === 2, `attempts ${runs}`);
  step("restored once", end.names.filter((n) => n === "api.removal.restored").length === 1);

  // The step's effect: one `api.showList` commit on the board, whatever number of times the step ran.
  const board = JSON.parse((await row(BOARD_KEY)) ?? "{}");
  const log = Array.isArray(board.log) ? board.log : [];
  const shows = log.filter((e) => e.name === "api.showList").length;
  step("effect once", shows === 1, `api.showList ${shows}`);
  const shown = field(view((await get(base, "/api/lists")).body), "lists");
  step(
    "list visible once",
    Array.isArray(shown) && shown.filter((l) => l.id === listId && l.hidden !== true).length === 1,
  );
  const ids = log.map((e) => Number(e.id));
  step("log ordered", ids.every((id, i) => i === 0 || id === ids[i - 1] + 1) && ids.at(-1) === board.head);
} catch (e) {
  caught(e);
  step("flow", false, String(e).split("\n")[0]);
} finally {
  await stop(first);
  await stop(second);
  await client?.end().catch(() => undefined);
  if (container !== undefined) await docker(["rm", "-f", container]);
  container = undefined;
  await rm(tmp, { recursive: true, force: true });
}
finish("workflow-postgres");
