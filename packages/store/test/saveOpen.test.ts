// Seed 1337. saveStores, openHeld and storeShapes edges: the commit's writes, the conflict, the copy and restore errors.
import { type CtxEvent, createCtx, observe } from "@keel/ctx";
import { owner, scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { describe, expect, it, vi } from "vitest";
import { store, stores, transaction, tx } from "../src/index.ts";
import { copyOf, serverState, storeShapes } from "../src/internal/index.ts";

const Count = s.object({ n: s.number() });
const KEY = "keel.store.so.count";
const OTHER = "keel.store.so.other";
const factory = () => {
  const count = store(Count, { n: 0 }, { id: "so.count" });
  const other = store(Count, { n: 0 }, { id: "so.other" });
  const inc = transaction(count, "so.inc", s.object({}), (st) => ({ n: st.n + 1 }));
  return { count, other, inc };
};
const isOpened = (v: unknown): v is ReturnType<typeof factory> =>
  typeof v === "object" && v !== null && "count" in v && "inc" in v;
const open = async (p: Promise<unknown>): Promise<ReturnType<typeof factory>> => {
  const v = await p;
  if (!isOpened(v)) throw new Error("not the factory's value");
  return v;
};

describe("saveStores", () => {
  it("treats a restored store with meta in its log as unchanged: no commit, no save event", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    await ctx.storage.set(
      KEY,
      JSON.stringify({
        state: { n: 1 },
        log: [{ id: 1, name: "so.inc", payload: {}, at: 1, meta: { who: "a" } }],
        initial: { n: 0 },
        head: 1,
      }),
    );
    const events: CtxEvent[] = [];
    observe(ctx, (e) => {
      if (e.kind === "save") events.push(e);
    });
    const commit = vi.spyOn(ctx.storage, "commit");
    const rq = serverState(ctx).request();
    const a = await open(rq.stores(factory));
    expect(a.count.log().map((e) => e.meta)).toEqual([{ who: "a" }]);
    expect(await rq.save()).toBeNull();
    rq.end();
    expect(commit).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it("commits every opened key: the changed one with its value, an unchanged one only as a condition", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const commit = vi.spyOn(ctx.storage, "commit");
    const rq = serverState(ctx).request();
    const a = await open(rq.stores(factory));
    tx(a.inc, {});
    expect(await rq.save()).toBeNull();
    rq.end();
    expect(commit).toHaveBeenCalledTimes(1);
    const writes = commit.mock.calls[0]?.[0] ?? [];
    expect(writes.map((w) => w.key).sort()).toEqual([KEY, OTHER]);
    const changed = writes.find((w) => w.key === KEY);
    const same = writes.find((w) => w.key === OTHER);
    expect(changed?.expect).toBeNull();
    expect(typeof changed?.value).toBe("string");
    expect(same?.expect).toBeNull();
    expect(same).not.toHaveProperty("value");
  });

  it("answers the conflict with its message and data, and drops the keys it named from the copy", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const slow = serverState(ctx).request();
    const quick = serverState(ctx).request();
    const a = await open(slow.stores(factory));
    const b = await open(quick.stores(factory));
    tx(b.inc, {});
    expect(await quick.save()).toBeNull();
    tx(a.inc, {});
    expect(copyOf(ctx.storage).saved.has(KEY)).toBe(true);
    expect(await slow.save()).toEqual({
      code: "keel.conflict",
      message: "store so.count changed since this request read it",
      data: { store: "so.count" },
    });
    expect(copyOf(ctx.storage).saved.has(KEY)).toBe(false);
    slow.end();
    quick.end();
  });

  it("takes the written text into the copy, parsed", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const rq = serverState(ctx).request();
    const a = await open(rq.stores(factory));
    tx(a.inc, {});
    expect(await rq.save()).toBeNull();
    rq.end();
    const raw = await ctx.storage.get(KEY);
    const kept = copyOf(ctx.storage).saved.get(KEY);
    expect(raw).not.toBeNull();
    expect(kept?.raw).toBe(raw);
    expect(Reflect.get(kept?.json ?? {}, "state")).toEqual({ n: 1 });
  });
});

describe("openHeld (through serverState)", () => {
  it("reuses the copy's parse for an unchanged stored value, and records one for an absent key", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    await ctx.storage.set(KEY, JSON.stringify({ state: { n: 3 }, log: [], initial: { n: 3 } }));
    const one = serverState(ctx).request();
    await open(one.stores(factory));
    const first = copyOf(ctx.storage).saved.get(KEY);
    const absent = copyOf(ctx.storage).saved.get(OTHER);
    expect(first?.json).not.toBeNull();
    expect(absent).toEqual({ raw: null, json: null });
    one.end();
    const two = serverState(ctx).request();
    await open(two.stores(factory));
    expect(copyOf(ctx.storage).saved.get(KEY)).toBe(first);
    two.end();
  });

  it("throws, naming the store and the reason, for a saved snapshot that does not restore", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    await ctx.storage.set(KEY, JSON.stringify({ state: { n: "x" }, log: [], initial: { n: 0 } }));
    const rq = serverState(ctx).request();
    await expect(rq.stores(factory)).rejects.toThrow(/^store so\.count: saved snapshot does not restore: .+/);
    rq.end();
  });
});

describe("storeShapes", () => {
  it("runs the factory with a sim ctx by default", () => {
    const seen: number[] = [];
    storeShapes((ctx) => {
      seen.push(ctx.clock.now());
      return factory();
    });
    expect(seen).toEqual([0]);
  });

  it("hands the factory the ctx it is given", () => {
    const ctx = createCtx({ mode: "sim", seed: 7 });
    let got: unknown;
    storeShapes((c) => {
      got = c;
      return factory();
    }, ctx);
    expect(got).toBe(ctx);
  });

  it("runs in a scope detached from the caller's, with its own registry, and disposes it", () => {
    let disposed = 0;
    let above: unknown = "unset";
    const probe = () => {
      above = owner()?.parent;
      owner()?.onDispose(() => disposed++);
      return factory();
    };
    scope(
      () => {
        store(Count, { n: 0 }, { id: "so.count" });
        expect(storeShapes(probe).map((x) => x.id)).toEqual(["so.count", "so.other"]);
        expect([...stores().keys()]).toEqual(["so.count"]);
      },
      { detached: true },
    ).dispose();
    expect(above).toBeUndefined();
    expect(disposed).toBe(1);
  });

  it("disposes the scope when the factory throws, and rethrows", () => {
    let disposed = 0;
    expect(() =>
      storeShapes(() => {
        owner()?.onDispose(() => disposed++);
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(disposed).toBe(1);
  });
});
