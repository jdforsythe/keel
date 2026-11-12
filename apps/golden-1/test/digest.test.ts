// The `digest` module served as topology.ts places it, in the `api` deployable beside `api`, with its runners, over a
// sim ctx: refresh, the hourly schedule, the event-stream feed, and a restart with a job left in the queue.
import { type SimCtx, createCtx } from "@keel/ctx";
import { createApp } from "@keel/server";
import { render } from "@keel/testing";
import { afterEach, describe, expect, it } from "vitest";
import { Digest } from "../modules/digest/Digest.schema.ts";
import { LATEST_KEY } from "../modules/digest/LATEST_KEY.ts";
import { RecountInput } from "../modules/digest/RecountInput.schema.ts";
import { boardApi } from "../modules/digest/boardApi.ts";
import { feedDigest } from "../modules/digest/feedDigest.server.ts";
import { jobs } from "../modules/digest/jobs.server.ts";
import { loadDigest } from "../modules/digest/loadDigest.server.ts";
import { readLatest } from "../modules/digest/readLatest.ts";
import { recount } from "../modules/digest/recount.server.ts";
import { refresh } from "../modules/digest/refresh.server.ts";
import { routes } from "../modules/digest/routes.ts";
import { runners } from "../modules/digest/runners.server.ts";
import { schedules } from "../modules/digest/schedules.server.ts";
import { writeLatest } from "../modules/digest/writeLatest.ts";
import topology from "../topology.ts";
import { apiRoutes } from "./apiRoutes.ts";
import { boardOf } from "./at.ts";
import { BOARD_KEY, apiApp, resetApi, seedBoard } from "./simApi.ts";

const ORIGIN = "http://localhost";
const HOUR = 3_600_000;
type App = Awaited<ReturnType<typeof createApp>>;

const open: App[] = [];
afterEach(async () => {
  for (const app of open.splice(0)) await app.close();
  resetApi();
});

/** Microtask turns for runners, jobs and in-process calls to settle; no timers. */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 400; i++) await Promise.resolve();
};

const board = boardOf({
  lists: [{ id: "l1", name: "Home" }],
  todos: [
    { id: "t1", listId: "l1", title: "Milk", priority: "normal", done: false },
    { id: "t2", listId: "l1", title: "Eggs", priority: "low", done: true },
    { id: "t3", listId: "l1", title: "Tea", priority: "high", done: false },
  ],
});

/** A sim ctx whose storage holds `board` as the saved `api.board`. */
async function seeded(seed = 1): Promise<SimCtx> {
  const ctx = createCtx({ mode: "sim", seed });
  await ctx.storage.set(BOARD_KEY, JSON.stringify({ state: board, log: [], initial: board }));
  return ctx;
}

/** The `api` deployable with the `digest` runners, over `ctx`. */
async function serve(ctx: SimCtx): Promise<App> {
  const app = await createApp({ topology, routes: apiRoutes, ctx, deployable: "api", runners: { digest: runners } });
  open.push(app);
  return app;
}

const get = (app: App, path: string) =>
  app.fetch(new Request(`${ORIGIN}${path}`, { headers: { accept: "application/json" } }));
const post = (app: App, path: string) =>
  app.fetch(
    new Request(`${ORIGIN}${path}`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", "x-keel": "1" },
      body: "{}",
    }),
  );
/** The `digest.show` value `GET /digest` answers. */
async function shown(app: App): Promise<unknown> {
  const body: unknown = await (await get(app, "/digest")).json();
  return Reflect.get(Object(Reflect.get(Object(Reflect.get(Object(body), "results")), "digest.show")), "value");
}

/** The `data:` payloads of an event stream, read one at a time. */
function dataLines(res: Response) {
  const reader = res.body?.getReader();
  const dec = new TextDecoder();
  let buf = "";
  return async (): Promise<unknown> => {
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

describe("digest schemas and routes", () => {
  it("Digest counts are non-negative ints; RecountInput is empty", () => {
    expect(Digest.parse({ open: 2, done: 1, at: 0 }).ok).toBe(true);
    expect(Digest.parse({ open: -1, done: 1, at: 0 }).ok).toBe(false);
    expect(RecountInput.parse({}).ok).toBe(true);
  });
  it("the digest routes are API routes without a view", () => {
    for (const id of ["digest.show", "digest.refresh", "digest.feed"] as const) {
      expect(routes.routes[id]).toMatchObject({ api: true });
      expect("component" in routes.routes[id]).toBe(false);
    }
  });
});

describe("digest loaders", () => {
  it("readLatest is zero before the first count and after a stored value that does not parse", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    expect(await readLatest(ctx)).toEqual({ open: 0, done: 0, at: 0 });
    await ctx.storage.set(LATEST_KEY, "{");
    expect(await readLatest(ctx)).toEqual({ open: 0, done: 0, at: 0 });
    await writeLatest(ctx, { open: 3, done: 4, at: 5 });
    expect(await readLatest(ctx)).toEqual({ open: 3, done: 4, at: 5 });
  });
  it("loadDigest and the feed's first yield are the stored digest", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    await writeLatest(ctx, { open: 1, done: 2, at: 3 });
    const args = { params: {}, search: {}, url: `${ORIGIN}/digest`, caller: "", stores: undefined };
    expect(await loadDigest.run(args, ctx)).toEqual({ ok: true, value: { open: 1, done: 2, at: 3 } });
    expect(await feedDigest.run(args, ctx)).toEqual({ ok: true, value: { open: 1, done: 2, at: 3 } });
  });
});

describe("digest jobs and actions on an unbound ctx", () => {
  it("recount reads api.lists through boardApi (unbound, in a page: the document origin) and stores the counts", async () => {
    await seedBoard(board);
    const app = await apiApp();
    const ctx = createCtx({ mode: "sim", seed: 1 });
    ctx.net.route(new URL("/api/*", location.href).href, (req) => app.fetch(req));
    const lists = await boardApi.lists({}, ctx);
    expect(lists.ok ? lists.value.todos.length : -1).toBe(3);
    ctx.clock.advance(42);
    expect(await recount.fn({}, ctx, new AbortController().signal)).toEqual({ ok: true, value: null });
    expect(await readLatest(ctx)).toEqual({ open: 2, done: 1, at: 42 });
  });
  it("recount fails with the api's error and stores nothing when the board read fails", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    ctx.net.route(new URL("/api/*", location.href).href, () => new Response("{}", { status: 500 }));
    const r = await recount.fn({}, ctx, new AbortController().signal);
    expect(r.ok ? null : r.error.code).toBe("api.status");
    expect(await ctx.storage.get(LATEST_KEY)).toBeNull();
  });
  it("refresh enqueues one digest.recount in the digest queue", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const args = { params: {}, url: `${ORIGIN}/digest/refresh`, caller: "", stores: undefined };
    expect(await refresh.run({}, args, ctx)).toEqual({ ok: true, value: null });
    const queue: unknown = JSON.parse((await ctx.storage.get("std.jobs.digest")) ?? "{}");
    expect(queue).toMatchObject({ q: [{ job: "digest.recount", input: {} }] });
  });
});

describe("digest in the api deployable", () => {
  it("POST /digest/refresh enqueues digest.recount, which counts the board through api.lists", async () => {
    const ctx = await seeded();
    const app = await serve(ctx);
    expect(await shown(app)).toEqual({ open: 0, done: 0, at: 0 });
    expect((await post(app, "/digest/refresh")).status).toBe(200);
    await settle();
    expect(await shown(app)).toEqual({ open: 2, done: 1, at: 0 });
  });
  it("the hourly schedule recounts at the start of the hour", async () => {
    const ctx = await seeded();
    const app = await serve(ctx);
    await settle();
    ctx.clock.advance(HOUR - 1);
    await settle();
    expect(await shown(app)).toEqual({ open: 0, done: 0, at: 0 });
    ctx.clock.advance(1);
    await settle();
    expect(await shown(app)).toEqual({ open: 2, done: 1, at: HOUR });
    expect(schedules).toBe(runners[1]);
  });
  it("GET /digest/feed streams the digest, then the next count", async () => {
    const ctx = await seeded();
    const app = await serve(ctx);
    const res = await app.fetch(new Request(`${ORIGIN}/digest/feed`, { headers: { accept: "text/event-stream" } }));
    expect(res.status).toBe(200);
    const next = dataLines(res);
    expect(await next()).toEqual({ ok: true, value: { open: 0, done: 0, at: 0 } });
    await post(app, "/digest/refresh");
    await settle();
    ctx.clock.advance(1000);
    await settle();
    expect(await next()).toEqual({ ok: true, value: { open: 2, done: 1, at: 0 } });
  });
  it("a job enqueued before close() runs after the next start on the same storage", async () => {
    const ctx = await seeded();
    const first = await serve(ctx);
    await settle();
    expect((await jobs.enqueue(ctx, "digest.recount", {}, { delayMs: 5000 })).ok).toBe(true);
    await first.close();
    ctx.clock.advance(5000);
    const second = await serve(ctx);
    await settle();
    expect(await shown(second)).toEqual({ open: 2, done: 1, at: 5000 });
  });
});
