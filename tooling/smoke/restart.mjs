// Restart proof for golden-1 on SQLite: build a copy, serve its api on a database file in a temporary folder, write a
// list, two todos, a toggle and an edit over HTTP, read the stored board row, SIGKILL the server, start it again on the
// same file: the stored row is byte-equal, GET answers the same board, and the next write's log entry is one higher.
// Usage: node tooling/smoke/restart.mjs. Nothing is written inside the repo; no database URL or stored value is printed.
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BOARD_KEY, buildCopy, field, freePort, get, post, ready, recorder, row, serve, stop, view } from "./built.mjs";

const { step, finish } = recorder();
const tmp = await mkdtemp(join(tmpdir(), "keel-smoke-restart-"));
let first;
let second;
try {
  step("build", await buildCopy(join(tmp, "app")));
  const file = join(tmp, "data", "keel.sqlite");
  await mkdir(join(tmp, "data"));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  first = serve(join(tmp, "app"), file, port);
  const up = await ready(base);
  step("serve", up);
  if (!up) throw new Error(`server did not answer: ${first.log.slice(-3).join(" | ")}`);

  let keys = 0;
  const write = (b = 0) => ({ key: `a${++keys}`, base: b, owner: "" });
  const board = async () => view((await get(base, "/api/lists")).body);
  const statuses = [await post(base, "/api/lists", { name: "Home", write: write() })];
  const listId = String(field(await board(), "lists", "0", "id"));
  for (const title of ["Milk", "Eggs"])
    statuses.push(await post(base, `/api/lists/${listId}/todos`, { title, priority: "normal", write: write() }));
  const todo = String(field(await board(), "todos", "1", "id"));
  statuses.push(await post(base, `/api/todos/${todo}/toggle`, { write: write() }));
  const head = Number(field(await board(), "head"));
  statuses.push(
    await post(base, `/api/todos/${todo}`, {
      title: "Oat milk",
      priority: "high",
      write: { key: `a${++keys}`, base: head, owner: "" },
    }),
  );
  step(
    "writes",
    statuses.every((s) => s === 200),
    statuses.join(" "),
  );

  const before = row(file, BOARD_KEY);
  const shown = JSON.stringify(await board());
  step("stored row", before !== undefined);
  first.child.kill("SIGKILL");
  await first.exited;
  step("sigkill", first.child.signalCode === "SIGKILL");

  second = serve(join(tmp, "app"), file, port);
  step("restart", await ready(base));
  const after = row(file, BOARD_KEY);
  step("row byte-equal", before !== undefined && before === after);
  step("GET equal", JSON.stringify(await board()) === shown);

  const snap = JSON.parse(after ?? "{}");
  const ids = (s) => (Array.isArray(s.log) ? s.log.map((e) => Number(e.id)) : []);
  const was = ids(snap);
  const next = await post(base, `/api/todos/${todo}/toggle`, { write: { key: "b1", base: 0, owner: "" } });
  const saved = JSON.parse(row(file, BOARD_KEY) ?? "{}");
  const added = ids(saved).filter((i) => !was.includes(i));
  step(
    "next entry",
    next === 200 && added.length === 1 && added[0] === Number(snap.head) + 1,
    `head ${snap.head} -> ${saved.head}`,
  );
} catch (e) {
  step("flow", false, String(e).split("\n")[0]);
} finally {
  await stop(first);
  await stop(second);
  await rm(tmp, { recursive: true, force: true });
}
finish("restart");
