// Hidden acceptance suite of golden-1-api (pass.ts copies it into apps/golden-1/test/, runs it, removes it): the split
// proof in one process. Topology A serves `api` and `digest` in one `node` deployable, topology B in two, each over
// sim ctxs of seed 1 with in-process peers. One request script runs through `api`; the transcripts (statuses, bodies,
// event `data`, final `digest.latest` and `api.board` states) must be equal once each ctx-minted id is replaced by its
// first-appearance index.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { type Ctx, type SimCtx, createCtx } from "@keel/ctx";
import { type Manifest, type RouteDef, manifest, routesArtifact } from "@keel/router";
import { type ServerApp, topology } from "@keel/server";
import { createApp } from "@keel/server";
import { expect, it } from "vitest";
import { routes as apiRoutes } from "../modules/api/routes.ts";
import { routes as digestRoutes } from "../modules/digest/routes.ts";
import { runners } from "../modules/digest/runners.server.ts";

const ORIGIN = "http://localhost";
const HOUR = 3_600_000;
const BOARD_KEY = "keel.store.api.board";
const QUEUE_KEY = "std.jobs.digest";
const LATEST_KEY = "digest.latest";

const A = topology({
  web: { modules: ["todos"], adapter: "client" },
  api: { modules: ["api", "digest"], adapter: "node" },
});
const B = topology({
  web: { modules: ["todos"], adapter: "client" },
  api: { modules: ["api"], adapter: "node" },
  digest: { modules: ["digest"], adapter: "node" },
});
type Routes = Manifest<Readonly<Record<string, RouteDef>>>;
const both: Routes = manifest({ ...apiRoutes.routes, ...digestRoutes.routes });

/** `routes.json` of the app's node routes, as forwarding reads it from `artifacts`. */
function artifacts(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "golden-1-split-"));
  fs.writeFileSync(path.join(dir, "routes.json"), JSON.stringify({ data: routesArtifact(both), hash: "" }));
  return dir;
}

/** Microtask turns for runners, jobs, forwarding and in-process calls to settle; no timers. */
async function settle(): Promise<void> {
  for (let i = 0; i < 2000; i++) await Promise.resolve();
}

/** A ctx over `sim` whose `api.board` saves wait while `held` is set: a write then holds every later board read. */
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
    },
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
  const send = async (req: Request) => {
    const res = await l.entry.fetch(req);
    const body: unknown = await res.json();
    t.push({ req: `${req.method} ${new URL(req.url).pathname}`, status: res.status, body });
    return body;
  };
  await send(post("/api/lists", { name: "Home" }));
  const listId = ids(field(await send(get("/api/lists")), "results", "api.lists", "value", "lists"), "id")[0] ?? "";
  for (const title of ["Milk", "Eggs", "Tea"])
    await send(post(`/api/lists/${listId}/todos`, { title, priority: "normal" }));
  const board = await send(get("/api/lists"));
  const [milk = "", eggs = ""] = ids(field(board, "results", "api.lists", "value", "todos"), "id");
  await send(post(`/api/todos/${eggs}/toggle`));
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
  const toggling = l.entry.fetch(post(`/api/todos/${milk}/toggle`));
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
    expect(run.leased, "the recount was leased when its deployable closed").toMatchObject([{ l: true }]);
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
