// Spec: k.sync Conformance, "An action that saves two stores reports two `save` events to an observer of the server ctx, after both are stored, each with its store's new head; a 409 or `err` action reports none."
// Seed 1337. Runs under plain Node; only runtime (JSON) requests are used. Interleavings use deferreds and bounded microtask yields; no timers.
// ASSUMPTION (as read-set-conflict.test.ts): the observer is added to the same ctx object that is passed to `createApp`.
import { createCtx, observe } from "@keel/ctx";
import type { CtxEvent } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { err, ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { store, transaction, tx } from "@keel/store";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const Items = s.object({ items: s.array(s.int()) });
const Add = s.object({ n: s.int() });
const Nope = s.error("app.nope", s.object({}));
const LISTS = "keel.store.app.lists";
const TODOS = "keel.store.app.todos";

interface Deferred {
  readonly promise: Promise<void>;
  resolve(): void;
}
function deferred(): Deferred {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
async function yieldTurns(n: number): Promise<void> {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

const factory = () => {
  const lists = store(Items, { items: [] }, { id: "app.lists" });
  const todos = store(Items, { items: [] }, { id: "app.todos" });
  const addList = transaction(lists, "app.addList", Add, (state, { n }) => ({ items: [...state.items, n] }));
  const addTodo = transaction(todos, "app.addTodo", Add, (state, { n }) => ({ items: [...state.items, n] }));
  return { lists, todos, addList, addTodo };
};

function postJson(app: { fetch(r: Request): Promise<Response> }, path: string, body: unknown): Promise<Response> {
  return app.fetch(
    new Request(`http://localhost${path}`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { accept: "application/json", "content-type": "application/json", origin: "http://localhost" },
    }),
  );
}

async function setup() {
  const map = new Map<string, string>();
  const base = createCtx({ mode: "sim", seed: 1337 });
  const storage = {
    async get(key: string): Promise<string | null> {
      return map.get(key) ?? null;
    },
    async set(key: string, value: string): Promise<void> {
      map.set(key, value);
    },
  };
  const ctx = { ...base, storage };
  const saves: Array<{ store: unknown; head: unknown; stored: readonly string[] }> = [];
  const events: CtxEvent[] = [];
  observe(ctx, (e) => {
    events.push(e);
    if (e.kind === "save") saves.push({ store: e.store, head: e.head, stored: [...map.keys()].sort() });
  });
  const gate = deferred();
  const arrived = deferred();
  const arrivedB = deferred();
  const gateB = deferred();

  // Saves both stores.
  const both = action({ input: Add, stores: factory }, async ({ n }, { stores }) => {
    tx(stores.addList, { n });
    tx(stores.addTodo, { n });
    return ok(null);
  });
  // Saves lists only.
  const listOnly = action({ input: Add, stores: factory }, async ({ n }, { stores }) => {
    tx(stores.addList, { n });
    return ok(null);
  });
  // Changes both stores, then answers err: saves none.
  const fail = action({ input: Add, stores: factory }, async ({ n }, { stores }) => {
    tx(stores.addList, { n });
    tx(stores.addTodo, { n });
    return err(Nope.make({}));
  });
  // Two overlapping instances: A (held) and B (held); the later save is 409.
  const slowA = action({ input: Add, stores: factory }, async ({ n }, { stores }) => {
    tx(stores.addList, { n });
    arrived.resolve();
    await gate.promise;
    return ok(null);
  });
  const slowB = action({ input: Add, stores: factory }, async ({ n }, { stores }) => {
    tx(stores.addList, { n });
    arrivedB.resolve();
    await gateB.promise;
    return ok(null);
  });
  const component = (): Node => document.createElement("p");
  const routes = manifest({
    "app.both": { path: "/both", component },
    "app.listOnly": { path: "/list-only", component },
    "app.fail": { path: "/fail", component },
    "app.slowA": { path: "/slow-a", component },
    "app.slowB": { path: "/slow-b", component },
  });
  routes.actions({
    "app.both": { POST: both },
    "app.listOnly": { POST: listOnly },
    "app.fail": { POST: fail },
    "app.slowA": { POST: slowA },
    "app.slowB": { POST: slowB },
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx,
    mode: "production",
  });
  return { app, ctx, events, saves, map, gate, gateB, arrived, arrivedB };
}

describe("k.sync: save reports", () => {
  test("an action that saves two stores reports two `save` events to an observer of the server ctx, each with its store's new head", async () => {
    const { app, saves } = await setup();
    const res = await postJson(app, "/both", { n: 1 });
    expect(res.status).toBe(200);
    const byStore = [...saves].sort((a, b) => String(a.store).localeCompare(String(b.store)));
    expect(byStore.map((e) => ({ store: e.store, head: e.head }))).toEqual([
      { store: "app.lists", head: 1 },
      { store: "app.todos", head: 1 },
    ]);
  });

  test("each `save` event carries the store's new head, whatever earlier requests saved", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 4 }), fc.integer({ min: 1, max: 100 }), async (before, n) => {
        const { app, saves } = await setup();
        for (let i = 0; i < before; i++) expect((await postJson(app, "/list-only", { n: i })).status).toBe(200);
        expect(saves.length).toBe(before);
        saves.length = 0;
        expect((await postJson(app, "/both", { n })).status).toBe(200);
        const heads = new Map(saves.map((e) => [e.store, e.head]));
        expect(saves.length).toBe(2);
        expect(heads.get("app.lists")).toBe(before + 1);
        expect(heads.get("app.todos")).toBe(1);
      }),
      { seed: 1337, numRuns: 8 },
    );
  });

  test("the `save` events arrive after both stores are stored", async () => {
    const { app, saves } = await setup();
    await postJson(app, "/both", { n: 1 });
    expect(saves.length).toBe(2);
    for (const e of saves) expect(e.stored).toEqual([LISTS, TODOS].sort());
  });

  test("an action that saves one store reports one `save` event", async () => {
    const { app, saves } = await setup();
    await postJson(app, "/list-only", { n: 1 });
    expect(saves.map((e) => e.store)).toEqual(["app.lists"]);
  });

  test("an `err` action reports no `save` event and stores nothing", async () => {
    const { app, saves, map } = await setup();
    const res = await postJson(app, "/fail", { n: 1 });
    expect(res.status).toBe(400);
    expect(saves).toEqual([]);
    expect(map.size).toBe(0);
  });

  test("a 409 action reports no `save` event: only the earlier save of two overlapping actions is reported", async () => {
    const { app, saves, gate, gateB, arrived, arrivedB } = await setup();
    const a = postJson(app, "/slow-a", { n: 1 });
    const b = postJson(app, "/slow-b", { n: 2 });
    await Promise.all([arrived.promise, arrivedB.promise]);
    gateB.resolve();
    expect((await b).status).toBe(200);
    expect(saves.map((e) => [e.store, e.head])).toEqual([["app.lists", 1]]);
    gate.resolve();
    await yieldTurns(10);
    const resA = await a;
    expect(resA.status).toBe(409);
    expect(saves.map((e) => [e.store, e.head])).toEqual([["app.lists", 1]]);
  });

  test("a `save` event is not replayed to an observer added later", async () => {
    const { app, ctx } = await setup();
    await postJson(app, "/both", { n: 1 });
    const late: CtxEvent[] = [];
    observe(ctx, (e) => {
      late.push(e);
    });
    expect(late.filter((e) => e.kind === "save")).toEqual([]);
  });
});
