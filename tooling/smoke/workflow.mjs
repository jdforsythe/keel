// Crash proof for the golden-1 removal workflow, built and on SQLite: a copy whose `restore` step waits 2,000 ms on
// `ctx.clock` with `timeoutMs: 3000`. Remove a list, undo it, SIGKILL the server once the stored instance shows
// `attempt` 1 (the step is running), start it again on the same file: within 10 s the instance is `kept`, the list is
// visible once, the step's attempts are counted by the log, and `api.removal.restored` is in the log once.
// Usage: node tooling/smoke/workflow.mjs. Nothing is written inside the repo; no database URL or stored value is printed.
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  row,
  serve,
  stop,
  view,
  wait,
} from "./built.mjs";

const { step, finish } = recorder();
const tmp = await mkdtemp(join(tmpdir(), "keel-smoke-workflow-"));
let first;
let second;
/** The stored instances of `api.removal` and the names of its log, or empty when the row is not there. */
const removals = (file) => {
  const raw = row(file, REMOVAL_KEY);
  const snap = raw === undefined ? {} : JSON.parse(raw);
  const log = Array.isArray(snap.log) ? snap.log : [];
  return { rows: Object.values(field(snap, "state", "instances") ?? {}), names: log.map((e) => String(e.name)) };
};
/** Poll `pred` every 50 ms for at most `ms`. */
async function until(pred, ms) {
  for (const end = Date.now() + ms; Date.now() < end; ) {
    if (pred()) return true;
    await wait(50);
  }
  return false;
}
try {
  const dir = join(tmp, "app");
  await copyApp(dir);
  // The copy's `restore` waits 2,000 ms on the clock, and its step times out at 3,000 ms.
  const restoreFile = join(dir, "modules", "api", "restore.server.ts");
  const src = await readFile(restoreFile, "utf8");
  const slow = src.replace(
    "if (id === undefined) return ok({});",
    "if (id === undefined) return ok({});\n  await ctx.clock.after(2000);",
  );
  const removalFile = join(dir, "modules", "api", "removal.server.ts");
  const rsrc = await readFile(removalFile, "utf8");
  const limited = rsrc.replace("restoring: { run: restore,", "restoring: { run: restore, timeoutMs: 3000,");
  step("plant", slow !== src && limited !== rsrc);
  await writeFile(restoreFile, slow);
  await writeFile(removalFile, limited);
  const built = await buildIn(dir);
  step("build", built);
  if (!built) throw new Error("build failed");

  const file = join(tmp, "data", "keel.sqlite");
  await mkdir(join(tmp, "data"));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  first = serve(dir, file, port);
  const up = await ready(base);
  step("serve", up);
  if (!up) throw new Error(`server did not answer: ${first.log.slice(-3).join(" | ")}`);

  // A list, removed and then undone: `restoring` runs the step.
  const key = (n) => ({ key: `w${n}`, base: 0, owner: "" });
  step("add list", (await post(base, "/api/lists", { name: "Home", write: key(1) })) === 200);
  const listId = String(field(view((await get(base, "/api/lists")).body), "lists", "0", "id"));
  step("remove", (await post(base, `/api/lists/${listId}/remove`)) === 200);
  const flow = String(field(view((await get(base, "/api/lists")).body), "removals", "0", "flow"));
  step("undo", (await post(base, `/api/removals/${flow}/undo`)) === 200);
  const running = await until(
    () => removals(file).rows.some((r) => r.state === "restoring" && r.attempt === 1),
    10_000,
  );
  step("step running", running);
  // The step is mid-wait (2,000 ms): the process dies inside it.
  first.child.kill("SIGKILL");
  await first.exited;
  step("sigkill", first.child.signalCode === "SIGKILL");
  const mid = removals(file);
  step("interrupted", mid.rows.every((r) => r.state === "restoring") && !mid.names.includes("api.removal.restored"));

  second = serve(dir, file, port);
  step("restart", await ready(base));
  const kept = await until(
    () => removals(file).rows.every((r) => r.state === "kept") && removals(file).rows.length === 1,
    10_000,
  );
  step("kept within 10s", kept);
  const end = removals(file);
  const runs = end.names.filter((n) => n === "api.removal.attempt").length;
  step("step ran twice", runs === 2, `attempts ${runs}`);
  step("restored once", end.names.filter((n) => n === "api.removal.restored").length === 1);
  const shown = field(view((await get(base, "/api/lists")).body), "lists");
  step(
    "list visible once",
    Array.isArray(shown) && shown.filter((l) => l.id === listId && l.hidden !== true).length === 1,
  );

  // The stored board's log folded from `initial` ends at the stored state: ids rise by one and the list is not hidden.
  const board = JSON.parse(row(file, BOARD_KEY) ?? "{}");
  const ids = Array.isArray(board.log) ? board.log.map((e) => Number(e.id)) : [];
  step("log ordered", ids.every((id, i) => i === 0 || id === ids[i - 1] + 1) && ids.at(-1) === board.head);
} catch (e) {
  step("flow", false, String(e).split("\n")[0]);
} finally {
  await stop(first);
  await stop(second);
  await rm(tmp, { recursive: true, force: true });
}
finish("workflow");
