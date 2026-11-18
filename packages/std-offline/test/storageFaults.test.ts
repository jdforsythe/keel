// Storage and ctx faults around the flush and `resolve` (std.outbox). Seed 1337.
import { type Ctx, type SimCtx, createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { endpoints } from "@keel/services";
import fc from "fast-check";
import { expect, test } from "vitest";
import { Write, outbox, resolve, send } from "../src/index.ts";

const ORIGIN = "http://app.keel.invalid";
const Api = endpoints({
  add: { method: "POST", path: "/add", body: s.object({ t: s.string(), write: Write }), output: s.object({}) },
});
let n = 0;
function declare() {
  const held: { o?: ReturnType<typeof outbox<typeof Api>> } = {};
  const sc = scope(() => {
    held.o = outbox(`faults${++n}.outbox`, Api, { module: "app" });
  });
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
    dispose: () => ctx.dispose(),
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
    dispose: () => base.dispose(),
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
    fc.asyncProperty(fc.string({ maxLength: 12 }), fc.string({ maxLength: 12 }), async (a, b) => {
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
