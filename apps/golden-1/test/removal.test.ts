// The list removal workflow (`removal`, std.workflows) served as topology.ts places it, in the `api` deployable with
// the `api` runners, over a sim ctx: the 10-minute wait, an undo, three failed purges compensated by `restoring`, and
// a restart while a purge is running (its commit refused by the storage, as when the process stops first).
import { type Ctx, type KeyValueStorage, type SimCtx, type StorageWrite, createCtx } from "@keel/ctx";
import { createApp } from "@keel/server";
import { afterEach, describe, expect, it } from "vitest";
import type { RemovalData } from "../modules/api/RemovalData.schema.ts";
import { runners } from "../modules/api/runners.server.ts";
import topology from "../topology.ts";
import { apiRoutes } from "./apiRoutes.ts";
import { boardOf } from "./at.ts";
import { BOARD_KEY, SECRET } from "./simApi.ts";

const ORIGIN = "http://localhost";
const WAIT = 600_000;
type App = Awaited<ReturnType<typeof createApp>>;

const open: App[] = [];
afterEach(async () => {
  for (const app of open.splice(0)) await app.close();
});

/** Microtask turns for runners, jobs and in-process calls to settle; no timers. */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 400; i++) await Promise.resolve();
};
/** Move the sim clock `ms` in steps of 1,000, settling after each. */
async function pass(ctx: SimCtx, ms: number): Promise<void> {
  for (let t = 0; t < ms; t += 1000) {
    ctx.clock.advance(Math.min(1000, ms - t));
    await settle();
  }
}

const board = boardOf({
  lists: [
    { id: "l1", name: "Home" },
    { id: "l2", name: "Work" },
  ],
  todos: [
    { id: "t1", listId: "l1", title: "Milk", priority: "normal", done: false },
    { id: "t2", listId: "l2", title: "Report", priority: "high", done: false },
  ],
});

async function seeded(): Promise<SimCtx> {
  const ctx = createCtx({ mode: "sim", seed: 5 });
  await ctx.storage.set(BOARD_KEY, JSON.stringify({ state: board, log: [], initial: board }));
  return ctx;
}

/** The `api` deployable over `ctx` with `api` runners (`runners.server.ts` unless given). */
async function serve(ctx: SimCtx, api: readonly { run(ctx: Ctx, signal: AbortSignal): Promise<void> }[] = runners) {
  const app = await createApp({
    topology,
    routes: apiRoutes,
    ctx,
    deployable: "api",
    secret: SECRET,
    runners: { api },
  });
  open.push(app);
  return app;
}

const post = (app: App, path: string) =>
  app.fetch(
    new Request(`${ORIGIN}${path}`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", "x-keel": "1" },
      body: "{}",
    }),
  );
/** The `api.lists` value `GET /api/lists` answers. */
async function lists(app: App) {
  const res = await app.fetch(new Request(`${ORIGIN}/api/lists`, { headers: { accept: "application/json" } }));
  const body: unknown = await res.json();
  return Reflect.get(Object(Reflect.get(Object(Reflect.get(Object(body), "results")), "api.lists")), "value");
}

type Row = { state: string; data: RemovalData; entered: number; attempt: number };
/** The stored instances of workflow store `id`, and its stored log's transaction names. */
async function stored(ctx: SimCtx, id = "api.removal"): Promise<{ rows: Row[]; names: string[] }> {
  const raw = await ctx.storage.get(`keel.store.${id}`);
  const snap: unknown = raw === null ? {} : JSON.parse(raw);
  const instances: unknown = Reflect.get(Object(Reflect.get(Object(snap), "state")), "instances") ?? {};
  const log: unknown = Reflect.get(Object(snap), "log");
  const rows: Row[] = Object.values(Object(instances));
  const names = Array.isArray(log) ? log.map((e: unknown) => String(Reflect.get(Object(e), "name"))) : [];
  return { rows, names };
}
async function storedBoard(ctx: SimCtx) {
  const raw = await ctx.storage.get(BOARD_KEY);
  return boardOf(Reflect.get(Object(raw === null ? {} : JSON.parse(raw)), "state"));
}

describe("removal through the api deployable", () => {
  it("hides the list at once and purges it and its todos after the 10-minute wait", async () => {
    const ctx = await seeded();
    const app = await serve(ctx);
    expect((await post(app, "/api/lists/l1/remove")).status).toBe(200);
    const view = await lists(app);
    expect(Reflect.get(Object(view), "lists")).toEqual([{ ...board.lists[0], hidden: true }, board.lists[1]]);
    expect(Reflect.get(Object(view), "removals")).toEqual([{ flow: expect.any(String), list: "l1", state: "hidden" }]);
    expect((await post(app, "/api/lists/l1/remove")).status).toBe(404);

    await pass(ctx, WAIT - 60_000);
    expect((await storedBoard(ctx)).lists).toHaveLength(2);
    await pass(ctx, 120_000);
    const after = await storedBoard(ctx);
    expect(after.lists.map((l) => l.id)).toEqual(["l2"]);
    expect(after.todos.map((t) => t.id)).toEqual(["t2"]);
    const { rows, names } = await stored(ctx);
    expect(rows.map((r) => r.state)).toEqual(["removed"]);
    expect(names.filter((n) => n === "api.removal.purged")).toHaveLength(1);
    expect(Reflect.get(Object(await lists(app)), "removals")).toEqual([]);
  });

  it("an undo while hidden shows the list again and nothing is purged", async () => {
    const ctx = await seeded();
    const app = await serve(ctx);
    expect((await post(app, "/api/lists/l1/remove")).status).toBe(200);
    const flow = String(Reflect.get(Object(Reflect.get(Object(await lists(app)), "removals")?.[0]), "flow"));
    expect((await post(app, `/api/removals/${flow}/undo`)).status).toBe(200);
    await pass(ctx, 5000);
    expect((await storedBoard(ctx)).lists).toEqual([{ ...board.lists[0], hidden: false }, board.lists[1]]);
    expect((await stored(ctx)).rows.map((r) => r.state)).toEqual(["kept"]);
    expect((await post(app, `/api/removals/${flow}/undo`)).status).toBe(404);
    await pass(ctx, WAIT + 60_000);
    expect((await storedBoard(ctx)).lists).toHaveLength(2);
    expect((await stored(ctx)).names).not.toContain("api.removal.purged");
  });
});

/**
 * `ctx` with a storage that answers `false` to every `commit` while `refuse` holds for its writes: a store whose
 * commit never lands, as when a process stops before it reaches the database.
 */
function refusing(ctx: SimCtx, refuse: (writes: readonly StorageWrite[]) => boolean): Ctx {
  const s = ctx.storage;
  const storage: KeyValueStorage = {
    get: (k) => s.get(k),
    set: (k, v) => s.set(k, v),
    read: (keys) => s.read(keys),
    commit: async (writes) => (refuse(writes) ? false : s.commit(writes)),
  };
  return { clock: ctx.clock, random: ctx.random, net: ctx.net, storage };
}
/** Whether `writes` save a board without list `l1`: `api.purgeList`'s commit. */
const purges = (writes: readonly StorageWrite[]): boolean =>
  writes.some(
    (w) =>
      w.key === BOARD_KEY &&
      w.value !== undefined &&
      !boardOf(JSON.parse(w.value).state).lists.some((l) => l.id === "l1"),
  );

describe("removal failures and restarts", () => {
  it("three failed purges are compensated by restoring: the list is shown again", async () => {
    const sim = await seeded();
    let refused = 0;
    const ctx = refusing(sim, (writes) => purges(writes) && ++refused > 0);
    const app = await createApp({
      topology,
      routes: apiRoutes,
      ctx,
      deployable: "api",
      secret: SECRET,
      runners: { api: runners },
    });
    open.push(app);
    expect((await post(app, "/api/lists/l1/remove")).status).toBe(200);
    await pass(sim, WAIT + 120_000);
    // Each purge is one `commitStores` of 3 runs, and the step has 3 attempts.
    expect(refused).toBe(9);
    expect((await storedBoard(sim)).lists).toEqual([{ ...board.lists[0], hidden: false }, board.lists[1]]);
    const { rows, names } = await stored(sim);
    expect(rows.map((r) => r.state)).toEqual(["kept"]);
    expect(names.filter((n) => n === "api.removal.purgeFailed")).toHaveLength(1);
    expect(names.filter((n) => n === "api.removal.attempt")).toHaveLength(4);
  });

  it("a restart while a purge runs runs it again, and the purge ends once", async () => {
    const sim = await seeded();
    let down = false;
    let tries = 0;
    const ctx = refusing(sim, (writes) => purges(writes) && (++tries, down));
    const serveOn = async () => {
      const app = await createApp({
        topology,
        routes: apiRoutes,
        ctx,
        deployable: "api",
        secret: SECRET,
        runners: { api: runners },
      });
      open.push(app);
      return app;
    };
    const first = await serveOn();
    expect((await post(first, "/api/lists/l1/remove")).status).toBe(200);
    // The first purge's commit never lands: the process stops while it runs.
    down = true;
    for (let t = 0; t < WAIT + 120_000 && tries === 0; t += 1000) await pass(sim, 1000);
    expect(tries).toBeGreaterThan(0);
    open.splice(open.indexOf(first), 1);
    await first.close();
    expect((await storedBoard(sim)).lists).toHaveLength(2);
    expect((await stored(sim)).rows.map((r) => r.state)).toEqual(["purging"]);
    down = false;
    await serveOn();
    await pass(sim, 70_000);
    const { rows, names } = await stored(sim);
    expect(rows.map((r) => [r.state, r.entered])).toEqual([["removed", 2]]);
    expect(names.filter((n) => n === "api.removal.purged")).toHaveLength(1);
    expect((await storedBoard(sim)).lists.map((l) => l.id)).toEqual(["l2"]);
  });
});
