// Hidden acceptance suite of golden-1-api (pass.ts copies it into apps/golden-1/test/, runs it, removes it).
// 1. The split proof in one process. Topology A serves `api` and `digest` in one `node` deployable, topology B in two,
// each over sim ctxs of seed 1 with in-process peers. One request script runs through `api`; the transcripts
// (statuses, bodies, event `data`, final `digest.latest` and `api.board` states) must be equal once each ctx-minted id
// is replaced by its first-appearance index.
// 2. The race proof (std.multi, std.conflicts). Two users of one `api` server, each in its own worker realm, run one
// script: user 1 edits Milk and toggles Bread offline while user 0 renames Milk and adds Eggs; user 1 reconnects. The
// group is written to `.keel/sessions/golden-1-race.group.json` in a temp dir and replayed. On the app as shipped
// (`api.editTodo` refuses concurrent writes) the edit is a conflict in user 1's outbox and no race is found; on the
// planted twin pass.ts builds (`api.editTodo` rebases) the edit loses user 0's rename and `findRaces` reports exactly
// that race.
// 3. The correctness twins (k.model, k.sim, std.statecharts). Without `KEEL_TWIN` each check holds on the app as
// shipped: `api.board` explored 3 writes deep from the race fixture keeps its invariant, `editorChart` closes with no
// unreached or dead state, and the outbox applies each write it let go of once under 100 generated schedules. In the
// copies pass.ts plants, `KEEL_TWIN` names the change and the check asserts how it fails: `invariant` (`addTodo` drops
// its duplicate-id test) is E1708 at a shortest path that `restore` and `tx` reproduce; `chart-theirs` (`conflict`
// loses `theirs`) leaves `conflict` dead; `schedule` (`postToggle` passes no write key or base to its transaction) is E1704 shrunk to one
// `lost` step, replayed alike and printed byte-equal twice.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { respond } from "@keel/cli/testing";
import { type Ctx, type SimCtx, createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { type Manifest, type RouteDef, manifest, routesArtifact } from "@keel/router";
import { type ServerApp, topology } from "@keel/server";
import { createApp } from "@keel/server";
import { findRaces, raceRecords } from "@keel/std-conflicts";
import { drain, send } from "@keel/std-offline";
import { coverage } from "@keel/std-statecharts";
import { tx as commit, isolate } from "@keel/store";
import { SimRun, explore, simulate } from "@keel/testing";
import { afterEach, describe, expect, it } from "vitest";
// @keel/std-sessions is no dependency of golden-1: the group API is read from the workspace package.
import { type SessionGroup, openGroup, replayGroup } from "../../../packages/std-sessions/src/group/index.ts";
import { TodoIdParams } from "../modules/api/TodoIdParams.schema.ts";
import { addList } from "../modules/api/addList.ts";
import { addTodo } from "../modules/api/addTodo.ts";
import { board } from "../modules/api/board.ts";
import { boardStores } from "../modules/api/boardStores.ts";
import { editTodo } from "../modules/api/editTodo.ts";
import { routes as apiRoutes } from "../modules/api/routes.ts";
import { runners as apiRunners } from "../modules/api/runners.server.ts";
import { toggleTodo } from "../modules/api/toggleTodo.ts";
import { routes as digestRoutes } from "../modules/digest/routes.ts";
import { runners } from "../modules/digest/runners.server.ts";
import { boardOutbox } from "../modules/todos/boardOutbox.ts";
import { editorChart } from "../modules/todos/editorChart.ts";

const ORIGIN = "http://localhost";
const HOUR = 3_600_000;
const BOARD_KEY = "keel.store.api.board";
const QUEUE_KEY = "std.jobs.digest";
const LATEST_KEY = "digest.latest";

const A = topology({
  web: { modules: ["todos"], adapter: "client" },
  api: { modules: ["api", "digest", "sessions"], adapter: "node" },
});
const B = topology({
  web: { modules: ["todos"], adapter: "client" },
  api: { modules: ["api", "sessions"], adapter: "node" },
  digest: { modules: ["digest"], adapter: "node" },
});
type Routes = Manifest<Readonly<Record<string, RouteDef>>>;
const both: Routes = manifest({ ...apiRoutes.routes, ...digestRoutes.routes });

/** The temp folders this file made and has not yet removed. */
const made: string[] = [];
/** A fresh temp folder named `prefix`-something, removed by `cleanTemp`. */
function tempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  made.push(dir);
  return dir;
}
/** Remove every folder `tempDir` made, whether the test passed, failed or threw; entries it did not make stay. */
function cleanTemp(): void {
  for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
}
afterEach(cleanTemp);

/** `routes.json` of the app's node routes, as forwarding reads it from `artifacts`. */
function artifacts(): string {
  const dir = tempDir("golden-1-split-");
  fs.writeFileSync(path.join(dir, "routes.json"), JSON.stringify({ data: routesArtifact(both), hash: "" }));
  return dir;
}

/** Microtask turns for runners, jobs, forwarding and in-process calls to settle; no timers. */
async function settle(): Promise<void> {
  for (let i = 0; i < 2000; i++) await Promise.resolve();
}

/** A ctx over `sim` whose `api.board` reads and saves wait while `held` is set: a write then holds every later board read. */
function gated(sim: SimCtx) {
  let held: Promise<void> | undefined;
  let release = (): void => undefined;
  const ctx: Ctx = {
    clock: sim.clock,
    random: sim.random,
    net: sim.net,
    storage: {
      get: (key) => sim.storage.get(key),
      set: async (key, value) => {
        if (key === BOARD_KEY && held !== undefined) await held;
        await sim.storage.set(key, value);
      },
      read: async (keys) => {
        if (held !== undefined && keys.includes(BOARD_KEY)) await held;
        return sim.storage.read(keys);
      },
      commit: async (writes) => {
        if (held !== undefined && writes.some((w) => w.key === BOARD_KEY && w.value !== undefined)) await held;
        return sim.storage.commit(writes);
      },
    },
    dispose: sim.dispose,
  };
  return {
    ctx,
    hold(): void {
      held = new Promise((r) => {
        release = r;
      });
    },
    release(): void {
      held = undefined;
      release();
    },
  };
}

type Layout = {
  entry: ServerApp;
  /** Close the deployable that holds `digest`, then start it again on the same ctx. */
  close(): Promise<void>;
  start(): Promise<void>;
  advance(ms: number): void;
  hold(): void;
  release(): void;
  read(key: string): Promise<string | null>;
  /** Requests `api` forwarded to the `digest` peer, and `digest`'s requests to the `api` peer. */
  hops(): { forwarded: string[]; peerCalls: string[] };
};

async function layoutA(): Promise<Layout> {
  const sim = createCtx({ mode: "sim", seed: 1 });
  const g = gated(sim);
  const dir = artifacts();
  const boot = () =>
    createApp({
      topology: A,
      deployable: "api",
      routes: both,
      ctx: g.ctx,
      runners: { digest: runners },
      artifacts: dir,
    });
  let app = await boot();
  const entry: ServerApp = { fetch: (req) => app.fetch(req), close: () => app.close() };
  return {
    entry,
    close: () => app.close(),
    start: async () => {
      app = await boot();
    },
    advance: (ms) => sim.clock.advance(ms),
    hold: g.hold,
    release: g.release,
    read: (key) => sim.storage.get(key),
    hops: () => ({ forwarded: [], peerCalls: [] }),
  };
}

async function layoutB(): Promise<Layout> {
  const apiSim = createCtx({ mode: "sim", seed: 1 });
  const digestSim = createCtx({ mode: "sim", seed: 1 });
  const g = gated(apiSim);
  const dir = artifacts();
  const made: { api?: ServerApp; digest?: ServerApp } = {};
  const seen: { api: string[]; digest: string[] } = { api: [], digest: [] };
  const lazy = (name: "api" | "digest", log = true): ServerApp => ({
    fetch: (req) => {
      if (log) seen[name].push(`${req.method} ${new URL(req.url).pathname}`);
      return made[name]?.fetch(req) ?? Promise.resolve(new Response(null, { status: 503 }));
    },
    close: async () => undefined,
  });
  const bootDigest = () =>
    createApp({
      topology: B,
      deployable: "digest",
      routes: digestRoutes,
      ctx: digestSim,
      runners: { digest: runners },
      peers: { api: lazy("api") },
      artifacts: dir,
    });
  made.api = await createApp({
    topology: B,
    deployable: "api",
    routes: apiRoutes,
    ctx: g.ctx,
    peers: { digest: lazy("digest") },
    artifacts: dir,
  });
  made.digest = await bootDigest();
  return {
    entry: lazy("api", false),
    close: async () => made.digest?.close(),
    start: async () => {
      made.digest = await bootDigest();
    },
    advance: (ms) => {
      apiSim.clock.advance(ms);
      digestSim.clock.advance(ms);
    },
    hold: g.hold,
    release: g.release,
    read: async (key) => (key === BOARD_KEY ? apiSim : digestSim).storage.get(key),
    hops: () => ({ forwarded: [...seen.digest], peerCalls: [...seen.api] }),
  };
}

const json = { accept: "application/json", "content-type": "application/json", "x-keel": "1" };
const get = (p: string) => new Request(`${ORIGIN}${p}`, { headers: { accept: "application/json" } });
const post = (p: string, body: unknown = {}) =>
  new Request(`${ORIGIN}${p}`, { method: "POST", headers: json, body: JSON.stringify(body) });

/** The `data:` payloads of an event stream, read one at a time. */
function dataLines(res: Response): () => Promise<unknown> {
  const reader = res.body?.getReader();
  const dec = new TextDecoder();
  let buf = "";
  return async () => {
    for (;;) {
      const line = /^data: (.*)$/m.exec(buf);
      if (line !== null) {
        buf = buf.slice(line.index + line[0].length);
        return JSON.parse(line[1] ?? "null");
      }
      const r = await reader?.read();
      if (r === undefined || r.done) return undefined;
      buf += dec.decode(r.value);
    }
  };
}

const field = (v: unknown, ...keys: string[]): unknown =>
  keys.reduce<unknown>((o, k) => (typeof o === "object" && o !== null ? Reflect.get(o, k) : undefined), v);
const ids = (v: unknown, key: string): string[] => (Array.isArray(v) ? v.map((x) => String(field(x, key))) : []);

/** Run the script through `l.entry`; returns the transcript and the facts the assertions read. */
async function script(l: Layout) {
  const t: unknown[] = [];
  // Each write carries its own key; base 0 is stale after the first, so the rebasing writes record it.
  let keys = 0;
  const write = () => ({ key: `w${++keys}`, base: 0, owner: "" });
  const send = async (req: Request) => {
    const res = await l.entry.fetch(req);
    const body: unknown = await res.json();
    t.push({ req: `${req.method} ${new URL(req.url).pathname}`, status: res.status, body });
    return body;
  };
  await send(post("/api/lists", { name: "Home", write: write() }));
  const listId = ids(field(await send(get("/api/lists")), "results", "api.lists", "value", "lists"), "id")[0] ?? "";
  for (const title of ["Milk", "Eggs", "Tea"])
    await send(post(`/api/lists/${listId}/todos`, { title, priority: "normal", write: write() }));
  const board = await send(get("/api/lists"));
  const [milk = "", eggs = ""] = ids(field(board, "results", "api.lists", "value", "todos"), "id");
  await send(post(`/api/todos/${eggs}/toggle`, { write: write() }));
  await send(post("/digest/refresh"));
  await settle();
  l.advance(1000);
  await settle();
  const afterRefresh = field(await send(get("/digest")), "results", "digest.show", "value");

  const feed = await l.entry.fetch(new Request(`${ORIGIN}/digest/feed`, { headers: { accept: "text/event-stream" } }));
  t.push({ req: "GET /digest/feed", status: feed.status, type: feed.headers.get("content-type") });
  const next = dataLines(feed);
  t.push({ event: await next() });
  l.advance(HOUR - 1000);
  await settle();
  l.advance(1000);
  await settle();
  const scheduled = await next();
  t.push({ event: scheduled });

  // Restart: hold the board's saves, toggle Milk (its save waits), refresh (the recount's board read waits behind
  // that save), close the deployable holding digest, let the save land, start it again on the same ctx.
  l.hold();
  const toggling = l.entry.fetch(post(`/api/todos/${milk}/toggle`, { write: write() }));
  await settle();
  await send(post("/digest/refresh"));
  await settle();
  const leased = field(JSON.parse((await l.read(QUEUE_KEY)) ?? "{}"), "q");
  await l.close();
  l.release();
  const toggled = await toggling;
  t.push({ req: "POST /api/todos/:milk/toggle", status: toggled.status, body: await toggled.json() });
  await l.start();
  await settle();
  l.advance(1000);
  await settle();
  const afterRestart = field(await send(get("/digest")), "results", "digest.show", "value");
  const queue: unknown = JSON.parse((await l.read(QUEUE_KEY)) ?? "{}");
  const latest: unknown = JSON.parse((await l.read(LATEST_KEY)) ?? "null");
  const saved: unknown = JSON.parse((await l.read(BOARD_KEY)) ?? "null");
  t.push({ latest, board: field(saved, "state"), queue: field(queue, "q"), failed: field(queue, "failed") });
  await l.close();
  return { transcript: t, afterRefresh, scheduled, leased, afterRestart, queue, hops: l.hops() };
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
/** The transcript as JSON with each ctx-minted id replaced by its first-appearance index. */
function normalized(t: unknown): string {
  const seen = new Map<string, number>();
  return JSON.stringify(t).replace(UUID, (id) => {
    const n = seen.get(id) ?? seen.size;
    seen.set(id, n);
    return `#${n}`;
  });
}

it("golden-1 as one node deployable and as two answers one request script alike", async () => {
  const one = await script(await layoutA());
  const two = await script(await layoutB());
  expect(one.afterRefresh).toEqual({ open: 2, done: 1, at: 0 });
  expect(one.scheduled).toEqual({ ok: true, value: { open: 2, done: 1, at: HOUR } });
  for (const run of [one, two]) {
    expect(run.leased, "the recount was leased when its deployable closed").toMatchObject([{ l: expect.any(Number) }]);
    expect(run.afterRestart).toEqual({ open: 1, done: 2, at: HOUR + 1000 });
    expect(field(run.queue, "q")).toEqual([]);
    expect(field(run.queue, "failed")).toEqual([]);
  }
  expect(one.hops).toEqual({ forwarded: [], peerCalls: [] });
  // In B every /digest request reaches digest through forwarding, and each recount reads the board through the peer.
  expect(two.hops.forwarded).toEqual([
    "POST /digest/refresh",
    "GET /digest",
    "GET /digest/feed",
    "POST /digest/refresh",
    "GET /digest",
  ]);
  expect(two.hops.peerCalls.length).toBeGreaterThanOrEqual(3);
  expect(new Set(two.hops.peerCalls)).toEqual(new Set(["GET /api/lists"]));
  expect(normalized(two.transcript)).toBe(normalized(one.transcript));
});

// ---- 2. the race proof ------------------------------------------------------------------------------------------

const GROUP_ORIGIN = "http://golden-1.test";
const GROUP_FILE = ".keel/sessions/golden-1-race.group.json";
const SECRET = "golden-1 race proof signs callers with this";
const USER = new URL("./user.ts", import.meta.url).href;
const home = {
  lists: [{ id: "l1", name: "Home" }],
  todos: [
    { id: "t1", listId: "l1", title: "Milk", priority: "normal", done: false },
    { id: "t2", listId: "l1", title: "Bread", priority: "normal", done: false },
  ],
};
/** The fixture as stored: Home with Milk and Bread, head 2. */
const BOARD = JSON.stringify({ state: home, log: [], initial: home, head: 2 });

/** Whether this copy of the app declares `api.editTodo` `'rebase'` (pass.ts's planted twin). */
function planted(): boolean {
  let concurrent = "";
  const sc = scope(() => undefined);
  isolate(sc);
  sc.run(() => {
    concurrent = boardStores().editTodo.concurrent;
  });
  sc.dispose();
  return concurrent === "rebase";
}

/** The `api` deployable over a group's sim ctx; `servers` keeps each ctx so a run can read its final board. */
const servers: SimCtx[] = [];
const serve = (ctx: SimCtx) => {
  servers.push(ctx);
  const app = createApp({ topology: A, deployable: "api", routes: both, ctx, secret: SECRET });
  return { fetch: async (req: Request) => (await app).fetch(req) };
};

const tx = (session: SessionGroup["users"][number] | undefined, from: number, to: number) =>
  (session?.events ?? []).flatMap((e) =>
    e.kind === "tx" && e.store === "todos.view" && e.at >= from && e.at < to ? [e.name] : [],
  );

/** Run the RFC script on a fresh group; every input is followed by `settle` and 1 ms on every clock. */
async function race(twin: boolean) {
  const g = await openGroup({
    user: USER,
    serve,
    users: 2,
    seed: 11,
    origin: GROUP_ORIGIN,
    server: { "api.board": BOARD },
  });
  let at = 0;
  const step = async (f: () => Promise<void>): Promise<void> => {
    await f();
    await g.settle();
    await g.advance(1);
    at++;
  };
  const u0 = g.user(0);
  const u1 = g.user(1);
  // 1. Both open Home; user 0 marks Milk done and user 1 sees it with no input of its own.
  await step(() => u0.navigate("/lists/l1"));
  await step(() => u1.navigate("/lists/l1"));
  const toggledAt = at;
  await step(() => u0.fire("todos.toggle.t1", { type: "change" }));
  const seen = (await u1.find("todos.toggle.t1")).state.checked;
  // 2. User 1 opens Milk's edit page, goes offline, sets priority high and saves: queued at base 3.
  await step(() => u1.navigate("/lists/l1/todos/t1/edit"));
  await step(() => g.setOnline(1, false));
  await step(() => u1.fire("todos.editForm:priority", { type: "input", value: "high" }));
  await step(() => u1.fire("todos.save", { type: "click" }));
  const queuedEdit = (await u1.state())["todos.outbox"];
  // 3. Still offline, user 1 marks Bread done: queued at base 3.
  await step(() => u1.fire("todos.toggle.t2", { type: "change" }));
  const queued = (await u1.state())["todos.outbox"];
  // 4. User 0 renames Milk to Oat milk (head 4) and adds Eggs (head 5).
  await step(() => u0.navigate("/lists/l1/todos/t1/edit"));
  await step(() => u0.fire("todos.editForm:title", { type: "input", value: "Oat milk" }));
  await step(() => u0.fire("todos.save", { type: "click" }));
  await step(() => u0.fire("todos.addForm:title", { type: "input", value: "Eggs" }));
  await step(() => u0.fire("todos.addTodo", { type: "click" }));
  // 5. User 1 comes back online; its outbox sends in order.
  await step(() => g.setOnline(1, true));
  const server = servers.at(-1);
  const board = async (): Promise<unknown> => JSON.parse((await server?.storage.get("keel.store.api.board")) ?? "null");
  const afterFlush = { outbox: (await u1.state())["todos.outbox"], board: await board() };
  // The edit's key: the first entry user 1 queued.
  const entries = field(queued, "entries");
  const key = String(field(Array.isArray(entries) ? entries[0] : undefined, "key"));
  const buttons = twin
    ? []
    : [(await u1.find(`todos.outbox.mine.${key}`)).name, (await u1.find(`todos.outbox.theirs.${key}`)).name];
  // On the shipped app user 1 keeps the other edit.
  if (!twin) await step(() => u1.fire(`todos.outbox.theirs.${key}`, { type: "click" }));
  const states = [await u0.state(), await u1.state()];
  const final = { outbox: states[1]?.["todos.outbox"], board: await board() };
  // 6. The group.
  const group = await g.stop();
  return { group, toggledAt, seen, queuedEdit, queued, afterFlush, key, buttons, final, states };
}

/** The group as a file in a fresh temp dir, at `.keel/sessions/golden-1-race.group.json`. */
function written(group: SessionGroup): string {
  const dir = tempDir("golden-1-race-");
  const file = path.join(dir, GROUP_FILE);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(group));
  return file;
}

const entryOf = (board: unknown, id: number): unknown => {
  const log = field(board, "log");
  return Array.isArray(log) ? log.find((e) => field(e, "id") === id) : undefined;
};
const todo = (board: unknown, id: string): unknown => {
  const todos = field(board, "state", "todos");
  return Array.isArray(todos) ? todos.find((t) => field(t, "id") === id) : undefined;
};

describe("golden-1 race", () => {
  it("two users on one server: the live view, the outbox, the policies, replay and the race report", async () => {
    const twin = planted();
    const run = await race(twin);
    const file = written(run.group);
    expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual(run.group);

    // Live: user 1 saw Milk done; its todos.view gained one todos.hydrate and nothing else.
    expect(run.seen).toBe(true);
    expect(tx(run.group.users[1], run.toggledAt, run.toggledAt + 1)).toEqual(["todos.hydrate"]);
    // Offline: the edit, then the toggle, queued at base 3.
    expect(field(run.queuedEdit, "entries")).toMatchObject([{ endpoint: "editTodo", state: "queued", base: 3 }]);
    expect(field(run.queued, "entries")).toMatchObject([
      { endpoint: "editTodo", state: "queued", base: 3 },
      { endpoint: "toggleTodo", state: "queued", base: 3 },
    ]);

    if (twin) {
      // The planted twin: the edit lands as a rebased entry over user 0's rename, which is lost.
      expect(field(run.afterFlush.outbox, "entries")).toEqual([]);
      expect(entryOf(run.afterFlush.board, 6)).toMatchObject({ name: "api.editTodo", base: 3, key: run.key });
      expect(entryOf(run.afterFlush.board, 7)).toMatchObject({ name: "api.toggleTodo", base: 3 });
      expect(todo(run.afterFlush.board, "t1")).toMatchObject({ title: "Milk", priority: "high" });
    } else {
      // Shipped: the edit is refused at head 5 and waits as a conflict; the toggle rebases as entry 6.
      expect(field(run.afterFlush.outbox, "entries")).toMatchObject([
        { endpoint: "editTodo", state: "conflict", base: 3, head: 5 },
      ]);
      expect(run.buttons).toEqual(["Keep mine", "Keep theirs"]);
      expect(entryOf(run.afterFlush.board, 6)).toMatchObject({ name: "api.toggleTodo", base: 3 });
      expect(entryOf(run.afterFlush.board, 7)).toBeUndefined();
      expect(todo(run.afterFlush.board, "t1")).toMatchObject({ title: "Oat milk", priority: "normal" });
      expect(todo(run.afterFlush.board, "t2")).toMatchObject({ done: true });
      // Keep theirs empties the outbox and leaves the server as it was.
      expect(field(run.final.outbox, "entries")).toEqual([]);
      expect(run.final.board).toEqual(run.afterFlush.board);
    }

    // Replay: reproduced, the same server board and user states, and two replays byte-equal.
    const replayed = await replayGroup(run.group, { user: USER, serve });
    expect(replayed.reproduced).toBe(true);
    expect(replayed.users.map((u) => u.unapplied)).toEqual([null, null]);
    expect(replayed.server["api.board"]).toEqual(run.final.board);
    expect(replayed.users.map((u) => u.state)).toEqual(run.states);
    expect(JSON.stringify(await replayGroup(run.group, { user: USER, serve }))).toBe(JSON.stringify(replayed));

    // The race report, and its compact line.
    const found = await findRaces(run.group, { user: USER, serve, stores: [boardStores] });
    const lines = respond(raceRecords(GROUP_FILE, found, found.replay.server), { format: "compact" })
      .stdout.split("\n")
      .filter((l) => l !== "");
    expect(found.unchecked).toEqual([]);
    if (twin) {
      expect(found.races).toEqual([
        {
          store: "api.board",
          kind: "order",
          entry: { id: 6, name: "api.editTodo", key: run.key },
          against: [
            { id: 4, name: "api.editTodo", key: field(entryOf(run.final.board, 4), "key") },
            { id: 5, name: "api.addTodo", key: field(entryOf(run.final.board, 5), "key") },
          ],
        },
      ]);
      expect(lines).toEqual([
        `E2701 ${GROUP_FILE}:1:1 race api.editTodo #6 over api.editTodo #4, api.addTodo #5 on api.board`,
      ]);
      const again = await findRaces(run.group, { user: USER, serve, stores: [boardStores] });
      expect(JSON.stringify(again)).toBe(JSON.stringify(found));
    } else {
      expect(found.races).toEqual([]);
      expect(lines).toEqual([]);
    }

    // Live parity: a second live run under the same seed gives a byte-equal group.
    expect(JSON.stringify((await race(twin)).group)).toBe(JSON.stringify(run.group));
  }, 600_000);
});

// ---- 3. the correctness twins -----------------------------------------------------------------------------------

/** Which planted change this copy carries (pass.ts sets it), else "" for the app as built. */
const TWIN = process.env.KEEL_TWIN ?? "";
/** The race fixture's payload lists: todo ids t1 (taken) and t3 (free), two titles, two priorities, lists l1 and l2. */
const fields = ["t1", "t3"].flatMap((id) =>
  ["Eggs", "Oat milk"].flatMap((title) => ["low", "high"].map((priority) => ({ id, title, priority }))),
);
const PAYLOADS = {
  "api.addList": [
    { id: "l1", name: "Home" },
    { id: "l2", name: "Shop" },
  ],
  "api.addTodo": fields.map((f) => ({ ...f, listId: "l1" })),
  "api.toggleTodo": [{ id: "t1" }, { id: "t3" }],
  "api.editTodo": fields,
};
/** An Error's `code`, `message` and `data`, read without a cast. */
const failure = (e: unknown) => ({
  code: field(e, "code"),
  message: e instanceof Error ? e.message : String(e),
  data: field(e, "data"),
});
async function caught(f: () => unknown): Promise<unknown> {
  try {
    await f();
  } catch (e) {
    return e;
  }
  return undefined;
}

/** One user toggles Bread (base 2) and edits Milk (base 3) through the outbox, against a fresh api each run. */
async function outboxScenario({ ctx, run }: { ctx: SimCtx; run: () => Promise<void> }): Promise<void> {
  const t1 = TodoIdParams.parse({ todoId: "t1" });
  const t2 = TodoIdParams.parse({ todoId: "t2" });
  if (!t1.ok || !t2.ok) throw new Error("todo ids do not parse");
  const server = createCtx({ mode: "sim", seed: 7 });
  await server.storage.set(BOARD_KEY, BOARD);
  const app = await createApp({ topology: A, deployable: "api", routes: both, ctx: server, secret: SECRET });
  ctx.net.route(new URL("/api/*", location.href).href, (req) => app.fetch(req));
  const page = scope(() => undefined);
  page.run(() => void drain(ctx, boardOutbox, { owner: "" }));
  const settled = (p: Promise<unknown>) =>
    p.then(
      () => true,
      () => false,
    );
  const toggled = settled(send(ctx, boardOutbox, "toggleTodo", { params: t2.value, body: {} }, { base: 2, owner: "" }));
  const body = { title: "Oat milk", priority: "high" as const };
  const edited = settled(send(ctx, boardOutbox, "editTodo", { params: t1.value, body }, { base: 3, owner: "" }));
  await run();
  await Promise.all([toggled, edited]);
  page.dispose();
  const saved: unknown = JSON.parse((await server.storage.get(BOARD_KEY)) ?? "null");
  const log = field(saved, "log");
  const count = (name: string) => (Array.isArray(log) ? log.filter((e) => field(e, "name") === name).length : -1);
  const left = boardOutbox.get("entries");
  for (const e of left) expect(["queued", "conflict", "failed"]).toContain(e.state);
  if (!left.some((e) => e.endpoint === "toggleTodo")) expect(count("api.toggleTodo")).toBe(1);
  if (!left.some((e) => e.endpoint === "editTodo")) expect(count("api.editTodo")).toBe(1);
}

describe("golden-1 twins", () => {
  it("api.board explored 3 writes deep from the race fixture", async () => {
    const sc = scope(() => undefined);
    isolate(sc);
    const { b, txs } = sc.run(() => {
      const b = board();
      return { b, txs: [addList(b), addTodo(b), toggleTodo(b), editTodo(b)] };
    });
    const before = JSON.stringify(b.snapshot({ meta: true }));
    const go = () => explore(txs, { from: home, payloads: PAYLOADS, depth: 3 });
    if (TWIN !== "invariant") {
      const r = go();
      expect(r.depth).toBe(3);
      expect(r.states[0]).toEqual(home);
    } else {
      const e = failure(await caught(go));
      expect(e.code).toBe("E1708");
      const snapshot = field(e.data, "snapshot");
      expect(field(snapshot, "log")).toEqual([]);
      expect(field(e.data, "transaction")).toBe("api.addTodo");
      expect(b.restore(snapshot).ok).toBe(true);
      const t = txs.find((x) => x.name === field(e.data, "transaction"));
      const r = t === undefined ? undefined : commit(t, field(e.data, "payload"));
      expect(r?.ok === false ? r.error.code : "committed").toBe("store.invariant");
    }
    sc.dispose();
    expect(before).not.toBe("");
  });

  it("editorChart closes over every event", () => {
    const r = explore(Object.values(editorChart.events));
    expect(r.complete).toBe(true);
    const dead = TWIN === "chart-theirs" ? ["conflict"] : [];
    expect(coverage(editorChart, r)).toEqual({ unreached: [], dead });
  });

  it("boardOutbox under 100 generated schedules, seed 11", async () => {
    const go = () => simulate(outboxScenario, { runs: 100, seed: 11 });
    if (TWIN !== "schedule") {
      expect(await go()).toEqual({ seed: 11, runs: 100 });
      return;
    }
    const first = failure(await caught(go));
    expect(first.code).toBe("E1704");
    const [reason, json] = first.message.split("\n");
    const run = SimRun.parse(JSON.parse(json ?? "null"));
    if (!run.ok) throw new Error(`shrunk run does not parse: ${run.error.message}`);
    const { net, storage, offline } = run.value.schedule;
    expect(net.filter((s) => s.fault !== "none").map((s) => s.fault)).toEqual(["lost"]);
    expect(storage.filter((s) => s === "fail")).toEqual([]);
    expect(offline).toEqual([]);
    const replayed = failure(await caught(() => simulate(outboxScenario, { replay: run.value })));
    expect(replayed.code).toBe("E1704");
    expect(replayed.message.split(" (seed")[0]).toBe(reason?.split(" (seed")[0]);
    const second = failure(await caught(go));
    expect(second.message).toBe(first.message);
  }, 300_000);
});

// 4. Storage and workflows across processes (k.persist, std.workflows): two `api` apps on one sim ctx behave as two
// processes sharing one database.
describe("golden-1 on shared storage", () => {
  const BOARD = JSON.stringify({
    state: {
      lists: [{ id: "l1", name: "Home" }],
      todos: [{ id: "t1", listId: "l1", title: "Milk", priority: "normal", done: false }],
    },
    log: [],
    initial: { lists: [], todos: [] },
    head: 0,
  });
  const twoApps = async (withRunners: boolean) => {
    const ctx = createCtx({ mode: "sim", seed: 3 });
    await ctx.storage.set(BOARD_KEY, BOARD);
    const make = () =>
      createApp({
        topology: A,
        deployable: "api",
        routes: both,
        ctx,
        secret: SECRET,
        ...(withRunners ? { runners: { api: apiRunners } } : {}),
      });
    return { ctx, apps: [await make(), await make()] };
  };
  it("two processes editing from one board head: the later save is 409 and the stored board is the earlier", async () => {
    const { ctx, apps } = await twoApps(false);
    const [p, q] = apps;
    const edit = (title: string) =>
      post("/api/todos/t1", { title, priority: "high", write: { key: title, base: 0, owner: "" } });
    const [a, b] = await Promise.all([p?.fetch(edit("Oat milk")), q?.fetch(edit("Soy milk"))]);
    expect([a?.status, b?.status].sort()).toEqual([200, 409]);
    const saved: unknown = JSON.parse((await ctx.storage.get(BOARD_KEY)) ?? "null");
    const won = a?.status === 200 ? "Oat milk" : "Soy milk";
    expect(field(saved, "state", "todos", "0", "title")).toBe(won);
    for (const app of apps) await app.close();
  });
  it("a removal served by two processes' runners purges once", async () => {
    const { ctx, apps } = await twoApps(true);
    expect((await apps[0]?.fetch(post("/api/lists/l1/remove")))?.status).toBe(200);
    for (let t = 0; t < 700_000; t += 1000) {
      ctx.clock.advance(1000);
      await settle();
    }
    const saved: unknown = JSON.parse((await ctx.storage.get(BOARD_KEY)) ?? "null");
    const names = (v: unknown): string[] => {
      const log = field(v, "log");
      return Array.isArray(log) ? log.map((e: unknown) => String(field(e, "name"))) : [];
    };
    expect(names(saved).filter((n) => n === "api.purgeList")).toHaveLength(1);
    expect(field(saved, "state", "lists")).toEqual([]);
    const flows: unknown = JSON.parse((await ctx.storage.get("keel.store.api.removal")) ?? "null");
    expect(names(flows).filter((n) => n === "api.removal.purged")).toHaveLength(1);
    for (const app of apps) await app.close();
  }, 120_000);
});

describe("golden-1 temp folders", () => {
  it("leaves no golden-1-race-* or golden-1-split-* entry behind once the cleanup runs", () => {
    const ours = (name: string): boolean => name.startsWith("golden-1-race-") || name.startsWith("golden-1-split-");
    const before = new Set(fs.readdirSync(os.tmpdir()).filter(ours));
    const split = artifacts();
    const race = tempDir("golden-1-race-");
    expect(fs.existsSync(split)).toBe(true);
    expect(fs.existsSync(race)).toBe(true);
    cleanTemp();
    expect(fs.existsSync(split)).toBe(false);
    expect(fs.existsSync(race)).toBe(false);
    expect(new Set(fs.readdirSync(os.tmpdir()).filter(ours))).toEqual(before);
  });
});
