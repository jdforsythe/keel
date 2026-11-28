// Storage and ctx faults around the flush and `resolve` (std.outbox). Seed 1337.
import { type Ctx, type SimCtx, createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { Write, drain, outbox, resolve, send } from "../src/index.ts";

const ORIGIN = "http://app.keel.invalid";
const Api = contract("app", {
  "app.add": { method: "POST", path: "/add", body: s.object({ t: s.string(), write: Write }), output: s.object({}) },
});
let n = 0;
function declare() {
  const held: { o?: ReturnType<typeof outbox<typeof Api>> } = {};
  const sc = scope(
    () => {
      held.o = outbox(`faults${++n}.outbox`, Api);
    },
    { detached: true },
  );
  if (held.o === undefined) throw new Error("no outbox");
  return { o: held.o, sc };
}
const sim = (storage: ("ok" | "fail")[]): SimCtx => {
  const ctx = createCtx({ mode: "sim", seed: 1337, schedule: { net: [], storage, offline: [], plans: {} } });
  ctx.net.route(`${ORIGIN}/add`, () => Response.json({ ok: true, value: {} }));
  return ctx;
};
const settle = async (): Promise<void> => {
  for (let i = 0; i < 400; i++) await Promise.resolve();
};
const stored = async (ctx: Ctx, id: string): Promise<unknown> =>
  JSON.parse((await ctx.storage.get(`keel.outbox.${id}`)) ?? "{}");
/** `ctx` with `storage.set` call number `hang` (from 0) never settling. */
const hanging = (ctx: SimCtx, hang: number): Ctx => {
  let calls = 0;
  const st = ctx.storage;
  return {
    clock: ctx.clock,
    random: ctx.random,
    net: ctx.net,
    storage: {
      get: (k) => st.get(k),
      set: (k, v) => (calls++ === hang ? new Promise<void>(() => {}) : st.set(k, v)),
      read: (ks) => st.read(ks),
      commit: (ws) => st.commit(ws),
    },
  };
};

test("a rejected flush write leaves no `queued` copy of the failed entry in storage", async () => {
  // Steps: the load's `get`, `send`'s `set`, then the flush's `sending` `set`, which rejects.
  const ctx = sim(["ok", "ok", "fail"]);
  const { o, sc } = declare();
  const r = await send(ctx, o, "add", { body: { t: "a" } }, { base: 0, owner: "u1" });
  expect(r.state === "failed" ? r.error.code : r.state).toBe("offline.storage");
  expect(await stored(ctx, o.id)).not.toMatchObject({ entries: [{ state: "queued" }] });
  sc.dispose();
});

test("a throw in the flush that is not a storage write is rethrown, not reported as offline.storage", async () => {
  const base = sim([]);
  base.net.route(`${ORIGIN}/add`, () => {
    throw new TypeError("network down");
  });
  // The clock throws: the service call answers `api.network`, then the flush's retry timer throws.
  const thrown = new RangeError("clock");
  const ctx: Ctx = {
    clock: {
      now: () => base.clock.now(),
      after: () => {
        throw thrown;
      },
    },
    random: base.random,
    net: base.net,
    storage: base.storage,
  };
  const reasons: unknown[] = [];
  const saved = process.listeners("unhandledRejection");
  process.removeAllListeners("unhandledRejection");
  process.on("unhandledRejection", (reason) => reasons.push(reason));
  const { o, sc } = declare();
  try {
    const r = await send(ctx, o, "add", { body: { t: "a" } }, { base: 0, owner: "u1" });
    await settle();
    await new Promise<void>((done) => setImmediate(done));
    expect(r).toEqual({ state: "queued" });
    expect(o.get("entries").map((e) => e.state)).toEqual(["queued"]);
    expect(reasons).toEqual([thrown]);
  } finally {
    process.removeAllListeners("unhandledRejection");
    for (const listener of saved) process.on("unhandledRejection", listener);
    sc.dispose();
  }
});

test("a storage write that never settles holds a later send only until 10 s pass on ctx.clock", async () => {
  const base = sim([]);
  // Call 0 is the first send's own write.
  const ctx = hanging(base, 0);
  const { o, sc } = declare();
  void send(ctx, o, "add", { body: { t: "a" } }, { base: 0, owner: "u1" });
  await settle();
  let later = "pending";
  void send(ctx, o, "add", { body: { t: "b" } }, { base: 0, owner: "u1" }).then((r) => {
    later = r.state;
  });
  await settle();
  base.clock.advance(9_999);
  await settle();
  expect(later).toBe("pending");
  base.clock.advance(1);
  for (let i = 0; i < 5; i++) await settle();
  expect(later).toBe("sent");
  expect(o.get("entries").map((e) => e.state)).toEqual(["failed"]);
  expect(await stored(base, o.id)).toMatchObject({ entries: [{ state: "failed" }] });
  sc.dispose();
});

test("'theirs' resolves true when its storage writes reject", async () => {
  // Steps: the load's `get`, `send`'s `set` and its second write (both reject: the entry is `failed`), then `resolve`'s
  // two writes (both reject).
  const ctx = sim(["ok", "fail", "fail", "fail", "fail"]);
  ctx.net.setOnline(false);
  const { o, sc } = declare();
  const r = await send(ctx, o, "add", { body: { t: "a" } }, { base: 0, owner: "u1" });
  const key = o.get("entries")[0]?.key ?? "";
  expect(r.state).toBe("failed");
  await expect(resolve(ctx, o, key, "theirs")).resolves.toBe(true);
  expect(o.get("entries")).toEqual([]);
  sc.dispose();
});

test("an offline.owner err's message is the outbox id and its data is empty, whatever the owners", async () => {
  await fc.assert(
    fc.asyncProperty(fc.string({ maxLength: 12 }), fc.string({ minLength: 1, maxLength: 12 }), async (a, b) => {
      fc.pre(a !== b);
      const ctx = sim([]);
      ctx.net.setOnline(false);
      const { o, sc } = declare();
      await send(ctx, o, "add", { body: { t: "x" } }, { base: 0, owner: a });
      await send(ctx, o, "add", { body: { t: "y" } }, { base: 0, owner: b });
      const first = o.get("entries")[0];
      expect(first?.state).toBe("failed");
      expect(first?.error).toEqual({ code: "offline.owner", message: o.id, data: {} });
      sc.dispose();
    }),
    { seed: 1337, numRuns: 20 },
  );
});

/** `ctx.storage.set` with each call held until `land(i)` lands the `i`-th held one (the oldest by default). */
const holding = (ctx: SimCtx) => {
  const real = ctx.storage.set.bind(ctx.storage);
  const held: (() => Promise<void>)[] = [];
  const set = (k: string, v: string): Promise<void> =>
    new Promise<void>((done) => held.push(async () => done(await real(k, v))));
  Object.defineProperty(ctx.storage, "set", { value: set, configurable: true, writable: true });
  return { land: async (i = 0): Promise<void> => held.splice(i, 1)[0]?.() };
};

test("a `send` whose owner stops being the ctx's while its owner change is written adds nothing and resolves offline.owner", async () => {
  const ctx = sim([]);
  const { o, sc } = declare();
  ctx.net.setOnline(false);
  await send(ctx, o, "add", { body: { t: "b" } }, { base: 0, owner: "b" });
  const storage = holding(ctx);
  // `a`'s owner change fails `b`'s entry and writes the outbox; `c` takes the ctx meanwhile.
  const a = send(ctx, o, "add", { body: { t: "a" } }, { base: 0, owner: "a" });
  await settle();
  const c = send(ctx, o, "add", { body: { t: "c" } }, { base: 0, owner: "c" });
  for (let i = 0; i < 4; i++) {
    await storage.land();
    await settle();
  }
  const out = await a;
  expect(out.state === "failed" ? out.error.code : out.state).toBe("offline.owner");
  expect((await c).state).toBe("queued");
  expect(o.get("entries").map((e) => [e.owner, e.state])).toEqual([
    ["b", "failed"],
    ["c", "queued"],
  ]);
  sc.dispose();
});

test("an entry another owner fails while its own write is in flight resolves offline.owner and is never posted", async () => {
  const ctx = sim([]);
  const posts: unknown[] = [];
  ctx.net.route(`${ORIGIN}/add`, async (req) => {
    posts.push(await req.json());
    return Response.json({ ok: true, value: {} });
  });
  const { o, sc } = declare();
  await send(ctx, o, "add", { body: { t: "warm" } }, { base: 0, owner: "a" });
  posts.length = 0;
  const storage = holding(ctx);
  const a = send(ctx, o, "add", { body: { t: "a" } }, { base: 0, owner: "a" });
  await settle();
  const stop = scope(
    () => {
      void drain(ctx, o, { owner: "b" });
    },
    { detached: true },
  );
  await settle();
  for (let i = 0; i < 4; i++) {
    await storage.land();
    await settle();
  }
  const out = await a;
  expect(out.state === "failed" ? out.error.code : out.state).toBe("offline.owner");
  expect(posts).toEqual([]);
  stop.dispose();
  sc.dispose();
});

test("a write given up at the 10 s bound that lands later is followed by one more write of the outbox", async () => {
  const ctx = sim([]);
  const { o, sc } = declare();
  ctx.net.setOnline(false);
  const storage = holding(ctx);
  const r = send(ctx, o, "add", { body: { t: "a" } }, { base: 0, owner: "u1" });
  await settle();
  ctx.clock.advance(10_000);
  await settle();
  // The write after the failure lands, then the given-up one with the entry `queued`, then the write it is followed by.
  await storage.land(1);
  await settle();
  expect((await r).state).toBe("failed");
  const second = await stored(ctx, o.id);
  await storage.land();
  await settle();
  expect(await stored(ctx, o.id)).toMatchObject({ entries: [{ state: "queued" }] });
  await storage.land();
  await settle();
  expect(await stored(ctx, o.id)).toEqual(second);
  expect(await stored(ctx, o.id)).toMatchObject({ entries: [{ state: "failed" }] });
  sc.dispose();
});
