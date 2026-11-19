// @vitest-environment happy-dom
// k.return Opening: what `returnOpenings` keeps in `ctx.storage` `keel.return`, and what the intake of return links
// does with it where conformance does not reach: a stored value of another shape, links delivered at once, and storage
// that fails (each counts as no opening). Seed 1337 for the properties.
import { type KeyValueStorage, type SimCtx, createCtx } from "@keel/ctx";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { identityMount } from "../src/identityMount.ts";
import { mountRequests } from "../src/internal/mountRequests.ts";
import { returnOpenings } from "../src/internal/returnOpenings.ts";

identityMount("/ret");
const KEY = "keel.return";
const ID = "dev.keel.ret";
const settle = async (): Promise<void> => {
  for (let i = 0; i < 100; i++) await Promise.resolve();
};
const sim = (): SimCtx => createCtx({ mode: "sim", seed: 1337 });

/** An intake of return links on `ctx`, its requests answered by a failure so none opens the browser again. */
function intake(ctx: SimCtx) {
  const sent: string[] = [];
  const opened: string[] = [];
  let closed = 0;
  ctx.net.route("*", async (req) => {
    sent.push(new URL(req.url).pathname);
    throw new TypeError("offline");
  });
  const { link } = mountRequests(ctx, {
    id: ID,
    open: (u) => void opened.push(u),
    close: () => {
      closed += 1;
    },
  });
  return { sent, opened, link, closed: () => closed };
}

/** `ctx` with its storage replaced. */
const withStorage = (ctx: SimCtx, storage: KeyValueStorage): SimCtx => ({ ...ctx, storage });

describe("returnOpenings", () => {
  it("records an opening with a deadline 600000 ms on; a new one replaces it", async () => {
    const ctx = sim();
    expect(await returnOpenings.record(ctx)).toBe(true);
    expect(await ctx.storage.get(KEY)).toBe(JSON.stringify({ deadline: 600000 }));
    await ctx.clock.advance(5);
    await returnOpenings.record(ctx);
    expect(await ctx.storage.get(KEY)).toBe(JSON.stringify({ deadline: 600005 }));
  });

  it("takes a pending opening once, and none at or past its deadline", async () => {
    const ctx = sim();
    expect(await returnOpenings.take(ctx)).toBe(false);
    await returnOpenings.record(ctx);
    expect(await returnOpenings.take(ctx)).toBe(true);
    expect(await returnOpenings.take(ctx)).toBe(false);
    await returnOpenings.record(ctx);
    await ctx.clock.advance(600000);
    expect(await returnOpenings.take(ctx)).toBe(false);
  });

  it("a stored value of another shape is no opening, and taking leaves it as it was", async () => {
    const shaped = fc.oneof(
      fc.string(),
      fc.jsonValue().map((v) => JSON.stringify(v)),
      fc.constantFrom(
        "",
        "null",
        "[600000]",
        '{"deadline":"600000"}',
        '{"deadline":null}',
        '{"deadline":1e400}',
        '{"deadline":600000,"by":"x"}',
        '{"Deadline":600000}',
        '{"deadline":0}',
        '{"deadline":600001}',
        '{"deadline":9007199254740991}',
      ),
    );
    await fc.assert(
      fc.asyncProperty(shaped, async (raw) => {
        fc.pre(!/^\{"deadline":([1-9]\d{0,4}|[1-5]\d{5}|600000)\}$/.test(raw));
        const ctx = sim();
        await ctx.storage.set(KEY, raw);
        const t = intake(ctx);
        expect(await returnOpenings.take(ctx)).toBe(false);
        await t.link(`${ID}:/ret/cb?code=c`);
        expect(t.sent).toEqual([]);
        expect(t.closed()).toBe(0);
        expect(await ctx.storage.get(KEY)).toBe(raw);
      }),
      { seed: 1337, numRuns: 200 },
    );
  });

  it("of any number of links delivered at once, exactly one takes the opening and sends its request", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 8 }), async (n) => {
        const ctx = sim();
        await returnOpenings.record(ctx);
        const t = intake(ctx);
        await Promise.all(Array.from({ length: n }, (_, i) => t.link(`${ID}:/ret/cb${i}?code=c`)));
        await settle();
        expect(t.sent).toHaveLength(1);
        expect(t.closed()).toBe(1);
        const takes = await Promise.all(Array.from({ length: n }, () => returnOpenings.take(ctx)));
        expect(takes.filter(Boolean)).toHaveLength(0);
      }),
      { seed: 1337, numRuns: 20 },
    );
  });

  it("of concurrent takes of one opening, exactly one is true", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 8 }), async (n) => {
        const ctx = sim();
        await returnOpenings.record(ctx);
        const takes = await Promise.all(Array.from({ length: n }, () => returnOpenings.take(ctx)));
        expect(takes.filter(Boolean)).toHaveLength(1);
      }),
      { seed: 1337, numRuns: 20 },
    );
  });

  it("storage that fails fails closed: a link sends nothing; an opening not recorded admits nothing", async () => {
    const fail = async (): Promise<never> => {
      throw new Error("storage down");
    };
    const modes: readonly ("get" | "commit" | "lost")[] = ["get", "commit", "lost"];
    for (const broken of modes) {
      const ctx = sim();
      await returnOpenings.record(ctx);
      const s = ctx.storage;
      const storage: KeyValueStorage = {
        get: broken === "get" ? fail : (k) => s.get(k),
        set: (k, v) => s.set(k, v),
        read: (ks) => s.read(ks),
        commit: broken === "commit" ? fail : broken === "lost" ? async () => false : (w) => s.commit(w),
      };
      const t = intake(withStorage(ctx, storage));
      await t.link(`${ID}:/ret/cb?code=c`);
      expect(t.sent).toEqual([]);
      expect(t.closed()).toBe(0);
    }
    const ctx = sim();
    const s = ctx.storage;
    const storage: KeyValueStorage = {
      get: (k) => s.get(k),
      set: fail,
      read: (ks) => s.read(ks),
      commit: (w) => s.commit(w),
    };
    expect(await returnOpenings.record(withStorage(ctx, storage))).toBe(false);
    expect(await returnOpenings.take(ctx)).toBe(false);
  });

  it("an opening is written by set and taken by commit: a take that cannot commit leaves it as stored", async () => {
    const ctx = sim();
    await returnOpenings.record(ctx);
    const stored = await ctx.storage.get(KEY);
    const s = ctx.storage;
    const writes: string[] = [];
    const storage: KeyValueStorage = {
      get: (k) => s.get(k),
      set: async (k, v) => {
        writes.push(`set ${k}`);
        await s.set(k, v);
      },
      read: (ks) => s.read(ks),
      commit: async () => {
        writes.push("commit");
        throw new Error("storage down");
      },
    };
    const t = intake(withStorage(ctx, storage));
    await t.link(`${ID}:/ret/cb?code=c`);
    expect(t.sent).toEqual([]);
    expect(writes).toEqual(["commit"]);
    expect(await ctx.storage.get(KEY)).toBe(stored);
    const next = sim();
    await next.storage.set(KEY, stored ?? "");
    const again = intake(next);
    await again.link(`${ID}:/ret/cb?code=c`);
    await again.link(`${ID}:/ret/cb?code=c`);
    expect(again.sent).toEqual(["/ret/cb"]);
  });

  it("a later opening whose set fails leaves the older one pending until its own deadline", async () => {
    for (const at of [599999, 600000]) {
      const ctx = sim();
      await returnOpenings.record(ctx);
      await ctx.clock.advance(300000);
      const s = ctx.storage;
      const storage: KeyValueStorage = {
        get: (k) => s.get(k),
        set: async () => {
          throw new Error("storage down");
        },
        read: (ks) => s.read(ks),
        commit: (w) => s.commit(w),
      };
      const failing = withStorage(ctx, storage);
      expect(await returnOpenings.record(failing)).toBe(false);
      await ctx.clock.advance(at - 300000);
      const t = intake(failing);
      await t.link(`${ID}:/ret/cb?code=c`);
      expect(t.sent, String(at)).toEqual(at < 600000 ? ["/ret/cb"] : []);
    }
  });

  it("a redirect to the shell's own scheme takes no opening and records none", async () => {
    const ctx = sim();
    await returnOpenings.record(ctx);
    const before = await ctx.storage.get(KEY);
    const sent: string[] = [];
    ctx.net.route("*", async (req) => {
      const u = new URL(req.url);
      sent.push(u.pathname);
      if (u.pathname === "/ret/x") return new Response(null, { status: 302, headers: { location: `${ID}:/ret/y` } });
      throw new TypeError("offline");
    });
    const { link } = mountRequests(ctx, { id: ID, open: () => undefined });
    await link(`${ID}:/ret/x`);
    await settle();
    expect(sent).toEqual(["/ret/x", "/ret/y"]);
    expect(await ctx.storage.get(KEY)).toBe("");
    expect(before).toBe(JSON.stringify({ deadline: 600000 }));
  });
});
