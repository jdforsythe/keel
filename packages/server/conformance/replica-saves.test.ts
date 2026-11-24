// Spec: k.sim, Conformance "With `createApp` A on sim ctx `a` and B on `b = replica(a)`, an action on either app that saves store `s` reports one `save` event to an observer of that app's ctx and none to an observer of the other's, and so for each of repeated saves; overlapping actions on A and B that save `s` from one read leave one saved and the other 409 `keel.conflict`."
// Seed: 1337. Runs under plain Node; only runtime (JSON) requests are used. Interleavings use deferreds; no timers.
// Reading: the clause names A's action; it holds the same for B's, so the first case is generated over which app serves the action and how many saves it makes (each save one event to the serving app's ctx only).
// Reading: the `save` event is `{ kind: 'save', store, head, from }` (k.persist Server saves, k.sync Saves); the store id is the `store` field.
import { createCtx, observe, replica } from "@keel/ctx";
import type { CtxEvent } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { store, transaction, tx } from "@keel/store";
import fc from "fast-check";
import { expect, it } from "vitest";

const Items = s.object({ items: s.array(s.int()) });
const Add = s.object({ n: s.int() });
const KEY = "keel.store.app.s";

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
const field = (v: unknown, k: string): unknown => (typeof v === "object" && v !== null ? Reflect.get(v, k) : undefined);

const factory = () => {
  const sStore = store(Items, { items: [] }, { id: "app.s" });
  const add = transaction(sStore, "app.add", Add, (state, { n }) => ({ items: [...state.items, n] }));
  return { s: sStore, add };
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
  const a = createCtx({ mode: "sim", seed: 1337 });
  const b = replica(a);
  const arrived = { A: deferred(), B: deferred() };
  const gate = { A: deferred(), B: deferred() };
  const appContract = contract("app", { "app.write": { path: "/write" }, "app.slow": { path: "/slow" } });
  // `write` reads and saves `s` at once.
  const write = action(appContract, "app.write", { input: Add, stores: factory }, async ({ n }, { stores }) => {
    tx(stores.add, { n });
    return ok(null);
  });
  // `slow` reads `s`, saves it, and waits at a gate that names the serving app by its input's sign.
  const slow = action(appContract, "app.slow", { input: Add, stores: factory }, async ({ n }, { stores }) => {
    stores.s.get("items");
    tx(stores.add, { n });
    const side = n < 0 ? "B" : "A";
    arrived[side].resolve();
    await gate[side].promise;
    return ok(null);
  });
  const component = (): Node => document.createElement("p");
  const start = (ctx: typeof a) =>
    createApp({
      topology: topology({ web: { modules: ["app"], adapter: "node" } }),
      routes: manifest(appContract, {
        "app.write": { component: component, POST: write },
        "app.slow": { component: component, POST: slow },
      }),
      ctx,
      mode: "production",
    });
  const A = await start(a);
  const B = await start(b);
  const seenA: CtxEvent[] = [];
  const seenB: CtxEvent[] = [];
  observe(a, (e) => void seenA.push(e));
  observe(b, (e) => void seenB.push(e));
  return { a, b, A, B, seenA, seenB, arrived, gate };
}

const saves = (events: readonly CtxEvent[]) => events.filter((e) => e.kind === "save");

it("with `createApp` A on sim ctx `a` and B on `b = replica(a)`, an action on A that saves store `s` reports one `save` event to an observer of `a` and none to an observer of `b`", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom("A" as const, "B" as const),
      fc.integer({ min: 1, max: 4 }),
      async (side, times) => {
        const { A, B, seenA, seenB } = await setup();
        const app = side === "A" ? A : B;
        for (let i = 1; i <= times; i++) {
          expect((await postJson(app, "/write", { n: i })).status).toBe(200);
          const mine = saves(side === "A" ? seenA : seenB);
          const theirs = saves(side === "A" ? seenB : seenA);
          expect(mine).toHaveLength(i);
          expect(theirs).toHaveLength(0);
          const last = mine[mine.length - 1];
          expect(field(last, "store")).toBe("app.s");
          expect(field(last, "head")).toBe(i);
        }
      },
    ),
    { seed: 1337, numRuns: 12 },
  );
});

it("overlapping actions on A and B that save `s` from one read leave one saved and the other 409 `keel.conflict`", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom("A" as const, "B" as const),
      fc.integer({ min: 1, max: 1000 }),
      fc.integer({ min: 1, max: 1000 }),
      async (earlier, x, y) => {
        const { a, A, B, arrived, gate } = await setup();
        // A's input is positive, B's negative (the gate's side).
        const pa = postJson(A, "/slow", { n: x });
        const pb = postJson(B, "/slow", { n: -y });
        await Promise.all([arrived.A.promise, arrived.B.promise]);
        const later = earlier === "A" ? "B" : "A";
        gate[earlier].resolve();
        const first = await (earlier === "A" ? pa : pb);
        expect(first.status).toBe(200);
        gate[later].resolve();
        const second = await (later === "A" ? pa : pb);
        expect(second.status).toBe(409);
        const body: unknown = await second.json();
        expect(field(field(body, "error"), "code")).toBe("keel.conflict");
        const stored = field(JSON.parse((await a.storage.get(KEY)) ?? "null"), "state");
        expect(stored).toEqual({ items: [earlier === "A" ? x : -y] });
      },
    ),
    { seed: 1337, numRuns: 10 },
  );
});
