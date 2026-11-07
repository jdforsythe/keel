// Spec: k.server, clause "A save is 409 `keel.conflict` if a store the action only read was saved since; no request sees one store before a save and another after it."
// Seed 1337. Runs under plain Node: happy-dom strips cookie headers. Only runtime (JSON) requests are used.
// Interleavings are made deterministic with deferreds and bounded microtask yields; no timers.
import { createCtx } from "@keel/ctx";
import { action, loader, manifest } from "@keel/router";
import { ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { store, transaction, tx } from "@keel/store";
import fc from "fast-check";
import { expect, test } from "vitest";

const Items = s.object({ items: s.array(s.int()) });
const Add = s.object({ n: s.int() });
const Pair = s.object({ lists: s.array(s.int()), todos: s.array(s.int()) });
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
function field(v: unknown, k: string): unknown {
  return typeof v === "object" && v !== null ? Reflect.get(v, k) : undefined;
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
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        origin: "http://localhost",
      },
    }),
  );
}

// ---- Part (a): write skew ----

async function setupSkew() {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const gates = new Map<string, Deferred>();
  const arrived = new Map<string, Deferred>();
  const slot = (m: Map<string, Deferred>, k: string): Deferred => {
    const d = m.get(k) ?? deferred();
    m.set(k, d);
    return d;
  };
  // A reads lists, writes todos.
  const actA = action({ input: Add, stores: factory }, async ({ n }, { stores }) => {
    stores.lists.get("items");
    tx(stores.addTodo, { n });
    slot(arrived, "A").resolve();
    await slot(gates, "A").promise;
    return ok(null);
  });
  // B writes lists.
  const actB = action({ input: Add, stores: factory }, async ({ n }, { stores }) => {
    tx(stores.addList, { n });
    slot(arrived, "B").resolve();
    await slot(gates, "B").promise;
    return ok(null);
  });
  const component = (): Node => document.createElement("p");
  const routes = manifest({
    "app.a": { path: "/a", actions: { POST: actA }, component },
    "app.b": { path: "/b", actions: { POST: actB }, component },
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx,
    mode: "production",
  });
  return { ctx, app, gate: (k: string) => slot(gates, k), arrive: (k: string) => slot(arrived, k) };
}

test("A save is 409 `keel.conflict` if a store the action only read was saved since (write skew: reads lists, writes todos)", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 1000 }), fc.integer({ min: 1001, max: 2000 }), async (a, b) => {
      const { ctx, app, gate, arrive } = await setupSkew();
      const pa = postJson(app, "/a", { n: a });
      const pb = postJson(app, "/b", { n: b });
      await Promise.all([arrive("A").promise, arrive("B").promise]);
      gate("B").resolve();
      const resB = await pb;
      expect(resB.status).toBe(200);
      expect(await ctx.storage.get(TODOS)).toBeNull();
      gate("A").resolve();
      const resA = await pa;
      expect(resA.status).toBe(409);
      const body: unknown = await resA.json();
      expect(field(body, "ok")).toBe(false);
      expect(field(field(body, "error"), "code")).toBe("keel.conflict");
      expect(await ctx.storage.get(TODOS)).toBeNull();
      expect(field(JSON.parse((await ctx.storage.get(LISTS)) ?? "null"), "state")).toEqual({ items: [b] });
    }),
    { seed: 1337, numRuns: 8 },
  );
});

test("A save is not 409 when nothing it read was saved since: the same action alone is 200 and saves its write", async () => {
  const { ctx, app, gate, arrive } = await setupSkew();
  const pa = postJson(app, "/a", { n: 7 });
  await arrive("A").promise;
  gate("A").resolve();
  expect((await pa).status).toBe(200);
  expect(field(JSON.parse((await ctx.storage.get(TODOS)) ?? "null"), "state")).toEqual({ items: [7] });
});

// ---- Part (b): read skew ----

async function setupSkewRead(holdKey: string, staleReturn: boolean) {
  const map = new Map<string, string>();
  const base = createCtx({ mode: "sim", seed: 1337 });
  const held = { armed: false, reached: deferred(), release: deferred() };
  const storage = {
    async get(key: string): Promise<string | null> {
      const captured = map.get(key) ?? null;
      if (held.armed && key === holdKey) {
        held.armed = false; // hold only the first read of the chosen key after arming
        held.reached.resolve();
        await held.release.promise;
        return staleReturn ? captured : (map.get(key) ?? null);
      }
      return captured;
    },
    async set(key: string, value: string): Promise<void> {
      map.set(key, value);
    },
  };
  const ctx = { ...base, storage };
  const seen: { lists: readonly number[] | undefined; todos: readonly number[] | undefined } = {
    lists: undefined,
    todos: undefined,
  };
  const both = action({ input: Add, stores: factory }, async ({ n }, { stores }) => {
    tx(stores.addList, { n });
    tx(stores.addTodo, { n });
    return ok(null);
  });
  const read = loader({ output: Pair, stores: factory }, async ({ stores }) => {
    const lists = stores.lists.get("items");
    const todos = stores.todos.get("items");
    seen.lists = lists;
    seen.todos = todos;
    return ok({ lists: [...lists], todos: [...todos] });
  });
  const routes = manifest({
    "app.both": { path: "/both", loader: read, actions: { POST: both }, component: () => document.createElement("p") },
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx,
    mode: "production",
  });
  return { app, held, seen, map };
}

test("No request sees one store before a save and another after it (a GET reading both stores while a POST saves both)", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom(LISTS, TODOS),
      fc.boolean(),
      fc.integer({ min: 1, max: 1000 }),
      async (holdKey, staleReturn, n) => {
        // Seed storage through a first app (so the snapshot format is the server's own).
        const seedRun = await setupSkewRead(holdKey, staleReturn);
        expect((await postJson(seedRun.app, "/both", { n: 0 })).status).toBe(200);
        // A fresh app over the same storage: its in-process cache is empty.
        const run = await setupSkewRead(holdKey, staleReturn);
        for (const [k, v] of seedRun.map) run.map.set(k, v);
        run.held.armed = true;
        const getP = run.app.fetch(new Request("http://localhost/both", { headers: { accept: "application/json" } }));
        await run.held.reached.promise;
        const postP = postJson(run.app, "/both", { n });
        // The POST may complete, or be held behind the GET; either is allowed.
        await Promise.race([postP, yieldTurns(200)]);
        run.held.release.resolve();
        const [got, wrote] = await Promise.all([getP, postP]);
        expect(wrote.status).toBe(200);
        expect(got.status).toBe(200);
        const before = [0];
        const after = [0, n];
        const consistent =
          (JSON.stringify(run.seen.lists) === JSON.stringify(before) &&
            JSON.stringify(run.seen.todos) === JSON.stringify(before)) ||
          (JSON.stringify(run.seen.lists) === JSON.stringify(after) &&
            JSON.stringify(run.seen.todos) === JSON.stringify(after));
        expect(consistent).toBe(true);
      },
    ),
    { seed: 1337, numRuns: 12 },
  );
});
