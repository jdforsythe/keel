// Seed 1337. commitStores over a hand-spied storage: its saves, retries on a refused commit and per-run scopes.
import { createCtx } from "@keel/ctx";
import { owner, scope } from "@keel/reactive";
import { err, ok, s } from "@keel/schema";
import { describe, expect, it, vi } from "vitest";
import { store, transaction, tx } from "../src/index.ts";
import { commitStores, copyOf } from "../src/internal/index.ts";

const Count = s.object({ n: s.number() });
const KEY = "keel.store.cs.count";
const factory = () => {
  const count = store(Count, { n: 0 }, { id: "cs.count" });
  const inc = transaction(count, "cs.inc", s.object({}), (st) => ({ n: st.n + 1 }));
  return { count, inc };
};
const stored = async (ctx: ReturnType<typeof createCtx>): Promise<unknown> => {
  const raw = await ctx.storage.get(KEY);
  return raw === null ? null : Reflect.get(JSON.parse(raw), "state");
};
const conflict = (e: { readonly code: string }): boolean => e.code === "keel.conflict";

describe("commitStores", () => {
  it("runs fn on the restored stores and saves an ok in one commit", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const commit = vi.spyOn(ctx.storage, "commit");
    const out = await commitStores(ctx, factory, (f) => {
      tx(f.inc, {});
      return ok(f.count.get("n"));
    });
    expect(out).toEqual(ok(1));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(await stored(ctx)).toEqual({ n: 1 });
  });

  it("returns an err as it is and saves nothing", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const commit = vi.spyOn(ctx.storage, "commit");
    const failure = err({ code: "app.no", data: {}, message: "no" } as const);
    const out = await commitStores(ctx, factory, (f) => {
      tx(f.inc, {});
      return failure;
    });
    expect(out).toBe(failure);
    expect(commit).not.toHaveBeenCalled();
    expect(await stored(ctx)).toBeNull();
  });

  it("commits nothing when fn changed nothing", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const commit = vi.spyOn(ctx.storage, "commit");
    const out = await commitStores(ctx, factory, () => ok("same"));
    expect(out).toEqual(ok("same"));
    expect(commit).not.toHaveBeenCalled();
  });

  it("runs fn again on a fresh read after a refused commit, up to 3 runs, and resolves its result", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const commit = vi.spyOn(ctx.storage, "commit");
    commit.mockResolvedValueOnce(false).mockResolvedValueOnce(false);
    let runs = 0;
    const out = await commitStores(ctx, factory, (f) => {
      runs++;
      tx(f.inc, {});
      return ok(runs);
    });
    expect(out).toEqual(ok(3));
    expect(runs).toBe(3);
    expect(await stored(ctx)).toEqual({ n: 1 });
  });

  it("resolves keel.conflict after exactly 3 refused runs and stores nothing", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const commit = vi.spyOn(ctx.storage, "commit");
    commit.mockResolvedValue(false);
    let runs = 0;
    const out = await commitStores(ctx, factory, (f) => {
      runs++;
      tx(f.inc, {});
      return ok(runs);
    });
    expect(runs).toBe(3);
    expect(commit).toHaveBeenCalledTimes(3);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(conflict(out.error)).toBe(true);
      expect(out.error.data).toEqual({ store: "cs.count" });
    }
    expect(await stored(ctx)).toBeNull();
  });

  it("gives each run its own scope with its own registry, disposed after the run", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    let disposed = 0;
    const watched = () => {
      owner()?.onDispose(() => disposed++);
      return factory();
    };
    const [a, b] = await Promise.all([
      commitStores(ctx, watched, (f) => {
        tx(f.inc, {});
        return ok("a");
      }),
      commitStores(ctx, watched, (f) => {
        tx(f.inc, {});
        return ok("b");
      }),
    ]);
    expect(a).toEqual(ok("a"));
    expect(b).toEqual(ok("b"));
    expect(await stored(ctx)).toEqual({ n: 2 });
    // two commits and the retry of the one that lost: three runs, three disposed scopes.
    expect(disposed).toBe(3);
  });

  it("opens the factory in a scope detached from the caller's", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    let above: unknown = "unset";
    const probe = () => {
      above = owner()?.parent?.parent;
      return factory();
    };
    let pending: Promise<unknown> = Promise.resolve();
    scope(() => {
      pending = commitStores(ctx, probe, () => ok(null));
    }).dispose();
    await pending;
    expect(above).toBeUndefined();
  });

  it("shares the storage's one copy with serverState readers", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    await commitStores(ctx, factory, (f) => {
      tx(f.inc, {});
      return ok(null);
    });
    expect(copyOf(ctx.storage).saved.get(KEY)?.raw).toBe(await ctx.storage.get(KEY));
  });
});
