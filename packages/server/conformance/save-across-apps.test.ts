// Spec: k.persist, Conformance "Two `createApp`s on one sim ctx, overlapping actions that read one store and save another: the later save is 409 and the stored values are the earlier one's."
// Seed: 1337. Runs under plain Node; only runtime (JSON) requests are used. Interleavings use deferreds; no timers.
// Action A reads `lists` and saves `todos`; action B reads `todos` and saves `lists`; A goes to the first app, B to the second.
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { store, transaction, tx } from "@keel/store";
import fc from "fast-check";
import { expect, it } from "vitest";

const Items = s.object({ items: s.array(s.int()) });
const Add = s.object({ n: s.int() });
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
      headers: { accept: "application/json", "content-type": "application/json", origin: "http://localhost" },
    }),
  );
}

async function setup() {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const arrived = { A: deferred(), B: deferred() };
  const gate = { A: deferred(), B: deferred() };
  const actA = action({ input: Add, stores: factory }, async ({ n }, { stores }) => {
    stores.lists.get("items");
    tx(stores.addTodo, { n });
    arrived.A.resolve();
    await gate.A.promise;
    return ok(null);
  });
  const actB = action({ input: Add, stores: factory }, async ({ n }, { stores }) => {
    stores.todos.get("items");
    tx(stores.addList, { n });
    arrived.B.resolve();
    await gate.B.promise;
    return ok(null);
  });
  const component = (): Node => document.createElement("p");
  const start = () => {
    const routes = manifest({ "app.a": { path: "/a", component }, "app.b": { path: "/b", component } });
    routes.actions({ "app.a": { POST: actA }, "app.b": { POST: actB } });
    return createApp({
      topology: topology({ web: { modules: ["app"], adapter: "node" } }),
      routes,
      ctx,
      mode: "production",
    });
  };
  const first = await start();
  const second = await start();
  return { ctx, first, second, arrived, gate };
}

const stateOf = async (ctx: { storage: { get(k: string): Promise<string | null> } }, key: string) =>
  field(JSON.parse((await ctx.storage.get(key)) ?? "null"), "state");

it.skip("two `createApp`s on one sim ctx, overlapping actions that read one store and save another: the later save is 409 and the stored values are the earlier one's", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom("A" as const, "B" as const),
      fc.integer({ min: 1, max: 1000 }),
      fc.integer({ min: 1001, max: 2000 }),
      async (earlier, a, b) => {
        const { ctx, first, second, arrived, gate } = await setup();
        const pa = postJson(first, "/a", { n: a });
        const pb = postJson(second, "/b", { n: b });
        await Promise.all([arrived.A.promise, arrived.B.promise]);
        const later = earlier === "A" ? "B" : "A";
        gate[earlier].resolve();
        const resEarlier = await (earlier === "A" ? pa : pb);
        expect(resEarlier.status).toBe(200);
        gate[later].resolve();
        const resLater = await (later === "A" ? pa : pb);
        expect(resLater.status).toBe(409);
        const body: unknown = await resLater.json();
        expect(field(field(body, "error"), "code")).toBe("keel.conflict");
        // Only the earlier save is stored: A saves `todos` with `a`, B saves `lists` with `b`.
        if (earlier === "A") {
          expect(await stateOf(ctx, TODOS)).toEqual({ items: [a] });
          expect(await ctx.storage.get(LISTS)).toBeNull();
        } else {
          expect(await stateOf(ctx, LISTS)).toEqual({ items: [b] });
          expect(await ctx.storage.get(TODOS)).toBeNull();
        }
      },
    ),
    { seed: 1337, numRuns: 8 },
  );
});
