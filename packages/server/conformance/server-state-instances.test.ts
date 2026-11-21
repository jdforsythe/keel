// Spec: k.server, clause "Overlapping actions on one factory's store each see only their own instance; the later save is 409 `keel.conflict`. A conflicting or `err` action and an unchanged store save nothing."
// Seed 1337. Runs under plain Node: happy-dom strips cookie headers. Only runtime (JSON) POSTs are used.
// Overlap is made deterministic with deferreds: each action commits synchronously, signals arrival, then awaits a gate.
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { err, ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { store, transaction, tx } from "@keel/store";
import fc from "fast-check";
import { expect, test } from "vitest";

const Notes = s.object({ items: s.array(s.int()) });
const Add = s.object({ n: s.int() });
const Nothing = s.object({});
const Boom = s.error("conf.boom", s.object({}));
const denied = s.error("keel.denied", s.object({}));
const KEY = "keel.store.conf.s";

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

const factory = () => {
  const box = store(Notes, { items: [] }, { id: "conf.s" });
  const add = transaction(box, "conf.add", Add, (state, { n }) => ({ items: [...state.items, n] }));
  return { s: box, add };
};

async function setup() {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const gates = new Map<number, Deferred>();
  const arrived = new Map<number, Deferred>();
  const gate = (n: number): Deferred => {
    const g = gates.get(n) ?? deferred();
    gates.set(n, g);
    return g;
  };
  const arrive = (n: number): Deferred => {
    const g = arrived.get(n) ?? deferred();
    arrived.set(n, g);
    return g;
  };
  const sawItems = new Map<number, readonly number[]>();
  const appContract = contract("app", {
    "app.slow": { path: "/slow" },
    "app.write": { path: "/write" },
    "app.undo": { path: "/undo" },
    "app.err": { path: "/err" },
    "app.touch": { path: "/touch" },
  });

  const slowWrite = action(appContract, "app.slow", { input: Add, stores: factory }, async ({ n }, { stores }) => {
    tx(stores.add, { n });
    arrive(n).resolve();
    await gate(n).promise;
    sawItems.set(n, stores.s.get("items"));
    return ok(null);
  });
  const write = action(appContract, "app.write", { input: Add, stores: factory }, async ({ n }, { caller, stores }) => {
    tx(stores.add, { n }, { meta: { caller } });
    return ok(null);
  });
  const undo = action(
    appContract,
    "app.undo",
    { input: Nothing, stores: factory },
    async (_input, { caller, stores }) =>
      stores.s.undoWhere((e) => e.meta?.caller === caller) ? ok(null) : err(denied.make({})),
  );
  const writeThenErr = action(appContract, "app.err", { input: Add, stores: factory }, async ({ n }, { stores }) => {
    tx(stores.add, { n });
    return err(Boom.make({}));
  });
  const touch = action(appContract, "app.touch", { input: Nothing, stores: factory }, async (_input, { stores }) => {
    stores.s.get("items");
    return ok(null);
  });
  const component = (): Node => document.createElement("p");
  const routes = manifest(appContract, {
    "app.slow": { component: component, POST: slowWrite },
    "app.write": { component: component, POST: write },
    "app.undo": { component: component, POST: undo },
    "app.err": { component: component, POST: writeThenErr },
    "app.touch": { component: component, POST: touch },
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx,
    mode: "production",
  });
  const post = (path: string, body: unknown, cookie?: string): Promise<Response> =>
    app.fetch(
      new Request(`http://localhost${path}`, {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          origin: "http://localhost",
          ...(cookie === undefined ? {} : { cookie }),
        },
      }),
    );
  return { ctx, post, gate, arrive, sawItems };
}

function field(v: unknown, k: string): unknown {
  return typeof v === "object" && v !== null ? Reflect.get(v, k) : undefined;
}
function stateOf(raw: string | null): unknown {
  if (raw === null) return undefined;
  const parsed: unknown = JSON.parse(raw);
  return field(parsed, "state");
}

test("Overlapping actions on one factory's store each see only their own instance; the later save is 409 `keel.conflict`", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 1000 }), fc.integer({ min: 1001, max: 2000 }), async (a, b) => {
      const { ctx, post, gate, arrive, sawItems } = await setup();
      const first = post("/slow", { n: a });
      const second = post("/slow", { n: b });
      await Promise.all([arrive(a).promise, arrive(b).promise]);
      gate(a).resolve();
      const resA = await first;
      expect(resA.status).toBe(200);
      gate(b).resolve();
      const resB = await second;
      expect(resB.status).toBe(409);
      const body: unknown = await resB.json();
      expect(field(body, "ok")).toBe(false);
      expect(field(field(body, "error"), "code")).toBe("keel.conflict");
      expect(sawItems.get(a)).toEqual([a]);
      expect(sawItems.get(b)).toEqual([b]);
      expect(stateOf(await ctx.storage.get(KEY))).toEqual({ items: [a] });
    }),
    { seed: 1337, numRuns: 8 },
  );
});

test("A conflicting action saves nothing: the persisted snapshot is exactly the first save's", async () => {
  const { ctx, post, gate, arrive } = await setup();
  const first = post("/slow", { n: 1 });
  const second = post("/slow", { n: 2 });
  await Promise.all([arrive(1).promise, arrive(2).promise]);
  gate(1).resolve();
  await first;
  const afterFirst = await ctx.storage.get(KEY);
  expect(afterFirst).not.toBeNull();
  gate(2).resolve();
  expect((await second).status).toBe(409);
  expect(await ctx.storage.get(KEY)).toBe(afterFirst);
});

test("An `err` action that committed a transaction saves nothing (key stays absent)", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 0, max: 1000 }), async (n) => {
      const { ctx, post } = await setup();
      const res = await post("/err", { n });
      expect(res.status).toBe(400);
      expect(await ctx.storage.get(KEY)).toBeNull();
    }),
    { seed: 1337, numRuns: 10 },
  );
});

test("An `err` action that committed a transaction saves nothing (existing value is byte-identical)", async () => {
  const { ctx, post } = await setup();
  expect((await post("/write", { n: 1 })).status).toBe(200);
  const before = await ctx.storage.get(KEY);
  expect(before).not.toBeNull();
  expect((await post("/err", { n: 2 })).status).toBe(400);
  expect(await ctx.storage.get(KEY)).toBe(before);
});

test("An unchanged store restored from storage is not saved (stored text stays byte-identical)", async () => {
  const { ctx, post } = await setup();
  const seeded = '{ "state": { "items": [ 7 ] },  "log": [ ],\n "initial": { "items": [ 7 ] } }';
  await ctx.storage.set(KEY, seeded);
  const res = await post("/touch", {});
  expect(res.status).toBe(200);
  expect(await ctx.storage.get(KEY)).toBe(seeded);
});

test("Undo scoped by caller: another caller's undo is denied and saves nothing; the writer's undo restores the earlier state", async () => {
  const { ctx, post } = await setup();
  expect(await ctx.storage.get(KEY)).toBeNull();
  const wrote = await post("/write", { n: 5 });
  expect(wrote.status).toBe(200);
  const pair = (wrote.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  expect(pair.startsWith("keel-caller=")).toBe(true);
  const afterWrite = await ctx.storage.get(KEY);
  expect(stateOf(afterWrite)).toEqual({ items: [5] });

  const other = await post("/undo", {}, "keel-caller=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  expect(other.status).toBe(403);
  expect(await ctx.storage.get(KEY)).toBe(afterWrite);

  const own = await post("/undo", {}, pair);
  expect(own.status).toBe(200);
  expect(stateOf(await ctx.storage.get(KEY))).toEqual({ items: [] });
});
