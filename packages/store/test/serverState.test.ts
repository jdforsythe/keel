// k.server Server state: the runner in `@keel/store/internal`. Each request restores a factory's stores from
// `ctx.storage` through the storage's one copy (`copyOf`), an `ok` save writes the changed ones and reports `save`, a
// stale read set is `keel.conflict`, and `end()` disposes the request's instances.
import { type CtxEvent, createCtx, observe } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { store, transaction, tx } from "../src/index.ts";
import { type StateRequest, copyOf, openStores, saveStores, serverState } from "../src/internal/index.ts";

const Count = s.object({ n: s.number() });
const KEY = "keel.store.ss.count";
const factory = () => {
  const count = store(Count, { n: 0 }, { id: "ss.count" });
  const inc = transaction(count, "ss.inc", s.object({}), (st) => ({ n: st.n + 1 }));
  return { count, inc };
};
const isCounter = (v: unknown): v is ReturnType<typeof factory> =>
  typeof v === "object" && v !== null && "count" in v && "inc" in v;
const counterOf = async (p: Promise<unknown>): Promise<ReturnType<typeof factory>> => {
  const v = await p;
  if (!isCounter(v)) throw new Error("not the factory's value");
  return v;
};
const stored = async (ctx: ReturnType<typeof createCtx>): Promise<unknown> => {
  const raw = await ctx.storage.get(KEY);
  return raw === null ? null : Reflect.get(JSON.parse(raw), "state");
};

describe("copyOf", () => {
  it("is one copy per storage object", () => {
    const a = createCtx({ mode: "sim", seed: 1 });
    const b = createCtx({ mode: "sim", seed: 1 });
    expect(copyOf(a.storage)).toBe(copyOf(a.storage));
    expect(copyOf(a.storage)).not.toBe(copyOf(b.storage));
  });
});

describe("serverState", () => {
  it("restores from storage, gives one instance per factory per request, and saves an ok's changes with a save event", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const seen: CtxEvent[] = [];
    const stop = observe(ctx, (e) => {
      if (e.kind === "save") seen.push(e);
    });
    const state = serverState(ctx);
    const one = state.request();
    const a = await counterOf(one.stores(factory));
    expect(await counterOf(one.stores(factory))).toBe(a);
    expect(a.count.get("n")).toBe(0);
    tx(a.inc, {});
    expect(await one.save()).toBeNull();
    one.end();
    expect(await stored(ctx)).toEqual({ n: 1 });
    expect(seen).toEqual([{ kind: "save", store: "ss.count", head: 1, from: 0 }]);
    const two = state.request();
    const b = await counterOf(two.stores(factory));
    expect(b).not.toBe(a);
    expect(b.count.get("n")).toBe(1);
    tx(b.inc, {});
    expect(await two.save()).toBeNull();
    two.end();
    expect(seen.at(-1)).toEqual({ kind: "save", store: "ss.count", head: 2, from: 1 });
    stop();
  });

  it("saves nothing when nothing changed", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const rq = serverState(ctx).request();
    await rq.stores(factory);
    expect(await rq.save()).toBeNull();
    rq.end();
    expect(await ctx.storage.get(KEY)).toBeNull();
  });

  it("answers keel.conflict for a stale read set and stores nothing of it, across two runners on one storage", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const slow = serverState(ctx).request();
    const quick = serverState(ctx).request();
    const a = await counterOf(slow.stores(factory));
    const b = await counterOf(quick.stores(factory));
    tx(b.inc, {});
    expect(await quick.save()).toBeNull();
    tx(a.inc, {});
    tx(a.inc, {});
    expect(await slow.save()).toMatchObject({ code: "keel.conflict", data: { store: "ss.count" } });
    expect(await stored(ctx)).toEqual({ n: 1 });
    slow.end();
    quick.end();
  });

  it("throws for a factory store with a default id", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const rq = serverState(ctx).request();
    await expect(rq.stores(() => store(Count, { n: 0 }))).rejects.toThrow(/explicit id/);
    rq.end();
  });

  it("refuses a second factory opening a store id another factory opened in the request, and never saves ok over it", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const other = () => ({ ...factory(), extra: store(Count, { n: 0 }, { id: "ss.extra" }) });
    const rq = serverState(ctx).request();
    const a = await counterOf(rq.stores(factory));
    await expect(rq.stores(other)).rejects.toThrow("store ss.count: id already in use by a live store");
    tx(a.inc, {});
    await expect(rq.save()).rejects.toThrow(/already in use/);
    rq.end();
    expect(await stored(ctx)).toBeNull();
    // The refusal is per request: the next request opens the second factory.
    const next = serverState(ctx).request();
    const b = await counterOf(next.stores(other));
    tx(b.inc, {});
    expect(await next.save()).toBeNull();
    next.end();
    expect(await stored(ctx)).toEqual({ n: 1 });
  });

  it("refuses the second of two factories sharing an id opened at once", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const twin = () => factory();
    const rq = serverState(ctx).request();
    const [a, b] = await Promise.allSettled([rq.stores(factory), rq.stores(twin)]);
    expect(a.status).toBe("fulfilled");
    expect(b.status === "rejected" ? String(b.reason) : b.status).toMatch(/ss\.count: id already in use/);
    rq.end();
  });
});

describe("openStores", () => {
  it("passes each restored store's schema and state to seen", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    await ctx.storage.set(KEY, JSON.stringify({ state: { n: 4 }, log: [], initial: { n: 4 } }));
    const states: unknown[] = [];
    const held: StateRequest = { scope: scope(() => undefined), held: new Map() };
    await openStores(ctx, held, factory, (_schema, st) => states.push(st));
    expect(states).toEqual([{ n: 4 }]);
    expect(await saveStores(ctx, held)).toBeNull();
    held.scope.dispose();
  });

  it("takes a store id back once the factory that opened it is dropped from held", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const twin = () => factory();
    const rq: StateRequest = { scope: scope(() => undefined), held: new Map() };
    await openStores(ctx, rq, factory);
    await expect(openStores(ctx, rq, twin)).rejects.toThrow(/already in use/);
    rq.held.clear();
    const b = await counterOf(openStores(ctx, rq, twin));
    tx(b.inc, {});
    expect(await saveStores(ctx, rq)).toBeNull();
    expect(await stored(ctx)).toEqual({ n: 1 });
    rq.scope.dispose();
  });
});
