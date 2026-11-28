// std.jobs Run, Restart, Inspect: the outcome codes of a run, leases, order, the retained keys and failures, and the
// runner's start and stop. Seed 1337
import { type Ctx, type KeyValueStorage, createCtx } from "@keel/ctx";
import { type KeelError, type Result, err, isDefect, ok, s } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { job, queue } from "../src/index.ts";
import { State } from "../src/internal/State.schema.ts";
import { dataOf } from "./dataOf.ts";

const SEED = 1337;
const KEY = "std.jobs.orders";
const turns = async (n: number) => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};
const settle = () => turns(300);
const input = s.object({ n: s.int() });
const sim = () => createCtx({ mode: "sim", seed: SEED });

type Stored = { id: string; job: string; input: unknown; at: number; n: number; l: number; key?: string };
const stored = (id: string, over: Partial<Stored> = {}): Stored => ({
  id,
  job: "orders.work",
  input: { n: 1 },
  at: 0,
  n: 0,
  l: 0,
  ...over,
});
const seed = (
  ctx: Ctx,
  q: readonly Stored[],
  done: readonly unknown[] = [],
  failed: readonly unknown[] = [],
): Promise<void> => ctx.storage.set(KEY, JSON.stringify({ q, done, failed }));
async function state(ctx: Ctx): Promise<State> {
  const raw: unknown = JSON.parse((await ctx.storage.get(KEY)) ?? "null");
  const r = State.parse(raw);
  if (!r.ok) throw new Error("no queue stored");
  return r.value;
}
function start(jobs: { run(ctx: Ctx, signal: AbortSignal): Promise<void> }, ctx: Ctx) {
  const stop = new AbortController();
  const run = jobs.run(ctx, stop.signal);
  return {
    stop,
    run,
    end: async () => {
      stop.abort();
      await run;
    },
  };
}
const never = () => new Promise<never>(() => undefined);

test("A run ends with the code of its error, a throw, a timeout, an unknown job id or an input the schema refuses", async () => {
  const cases: { name: string; code: string; row?: Stored }[] = [
    { name: "err", code: "orders.rejected" },
    { name: "async throw", code: "jobs.thrown" },
    { name: "sync throw", code: "jobs.thrown" },
    { name: "unknown", code: "jobs.unknown", row: stored("a", { job: "orders.gone" }) },
    { name: "bad input", code: "keel.fields", row: stored("a", { input: { n: "x" } }) },
  ];
  for (const c of cases) {
    const ctx = sim();
    const work = job({ input, attempts: 1 }, (): Promise<Result<null, KeelError<string, unknown>>> => {
      if (c.name === "sync throw") throw new Error("boom");
      if (c.name === "async throw") return Promise.reject(new Error("boom"));
      return Promise.resolve(err({ code: "orders.rejected", message: "no", data: {} }));
    });
    const jobs = queue({ "orders.work": work });
    await ctx.clock.advance(70);
    await seed(ctx, [c.row ?? stored("a")]);
    const r = start(jobs, ctx);
    await settle();
    await r.end();
    expect(await state(ctx), c.name).toEqual({
      q: [],
      done: [],
      failed: [{ id: "a", job: c.row?.job ?? "orders.work", code: c.code, at: 70 }],
    });
  }
});

test("A run that outlives timeoutMs ends jobs.timeout then, aborts its signal, and leaves no timer behind", async () => {
  const ctx = sim();
  let signal: AbortSignal | undefined;
  const work = job({ input, attempts: 1, timeoutMs: 5000 }, (_n, _c, sg) => {
    signal = sg;
    return never();
  });
  const jobs = queue({ "orders.work": work });
  await seed(ctx, [stored("a")]);
  const r = start(jobs, ctx);
  await settle();
  expect(signal?.aborted).toBe(false);
  ctx.clock.advance(4999);
  await settle();
  expect(signal?.aborted).toBe(false);
  expect((await state(ctx)).q.length).toBe(1);
  ctx.clock.advance(1);
  await settle();
  expect(signal?.aborted).toBe(true);
  expect(await state(ctx)).toEqual({
    q: [],
    done: [],
    failed: [{ id: "a", job: "orders.work", code: "jobs.timeout", at: 5000 }],
  });
  await r.end();
});

test("A run that finishes in time cancels its timeout timer", async () => {
  const ctx = sim();
  const jobs = queue({ "orders.work": job({ input, timeoutMs: 5000 }, async () => ok(null)) });
  await seed(ctx, [stored("a")]);
  const r = start(jobs, ctx);
  await settle();
  expect((await state(ctx)).q).toEqual([]);
  expect(ctx.clock.next()).toBeNull();
  await r.end();
});

test("A failed run before its last waits the backoff, then runs again with its run counted", async () => {
  const ctx = sim();
  const times: number[] = [];
  const work = job({ input, attempts: 3 }, async () => {
    times.push(ctx.clock.now());
    return err({ code: "orders.down", message: "down", data: {} });
  });
  const jobs = queue({ "orders.work": work });
  await seed(ctx, [stored("a")]);
  const r = start(jobs, ctx);
  await settle();
  expect(await state(ctx)).toMatchObject({ q: [{ at: 1000, n: 1, l: 0 }] });
  ctx.clock.advance(999);
  await settle();
  expect(times).toEqual([0]);
  ctx.clock.advance(1);
  await settle();
  expect(await state(ctx)).toMatchObject({ q: [{ at: 3000, n: 2, l: 0 }] });
  ctx.clock.advance(2000);
  await settle();
  expect(times).toEqual([0, 1000, 3000]);
  expect(await state(ctx)).toMatchObject({ q: [], failed: [{ id: "a", code: "orders.down", at: 3000 }] });
  await r.end();
});

test("A job's lease ends timeoutMs plus 1,000 ms after it starts, with its run counted", async () => {
  const ctx = sim();
  await ctx.clock.advance(250);
  const jobs = queue({ "orders.work": job({ input, timeoutMs: 5000 }, never) });
  await seed(ctx, [stored("a", { at: 100 })]);
  const r = start(jobs, ctx);
  await settle();
  expect((await state(ctx)).q).toMatchObject([{ id: "a", n: 1, l: 6250 }]);
  await r.end();
});

test("A job leased by a stopped process runs again once its lease has ended, not before", async () => {
  const ctx = sim();
  const calls: number[] = [];
  const jobs = queue({
    "orders.work": job({ input, timeoutMs: 5000 }, async () => {
      calls.push(ctx.clock.now());
      return ok(null);
    }),
  });
  await seed(ctx, [stored("a", { n: 1, l: 5000 })]);
  const r = start(jobs, ctx);
  await settle();
  ctx.clock.advance(4999);
  await settle();
  expect(calls).toEqual([]);
  ctx.clock.advance(1);
  await settle();
  expect(calls).toEqual([5000]);
  expect((await state(ctx)).q).toEqual([]);
  await r.end();
});

test("Due jobs run in `at` order, then `id` order, for any delays", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(fc.constantFrom(0, 0, 100, 200, 300), { minLength: 2, maxLength: 9 }), async (delays) => {
      const ctx = sim();
      const ran: number[] = [];
      const jobs = queue({
        "orders.work": job({ input }, async ({ n }) => {
          ran.push(n);
          return ok(null);
        }),
      });
      const ids: string[] = [];
      for (const [n, delayMs] of delays.entries()) {
        const r = await jobs.enqueue(ctx, "orders.work", { n }, { delayMs });
        ids.push(r.ok ? r.value : "");
      }
      const expected = delays
        .map((d, n) => ({ d, n, id: ids[n] ?? "" }))
        .sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .map((x) => x.n);
      ctx.clock.advance(1000);
      const r = start(jobs, ctx);
      await settle();
      expect(ran).toEqual(expected);
      await r.end();
    }),
    { seed: SEED, numRuns: 40 },
  );
});

test("Jobs enqueued later with a shorter delay run first; equal times run in id order", async () => {
  const ctx = sim();
  const ran: string[] = [];
  const jobs = queue({
    "orders.work": job({ input }, async ({ n }) => {
      ran.push(String(n));
      return ok(null);
    }),
  });
  await seed(ctx, [
    stored("c", { input: { n: 3 }, at: 5 }),
    stored("b", { input: { n: 2 }, at: 5 }),
    stored("a", { input: { n: 1 }, at: 5 }),
    stored("z", { input: { n: 0 }, at: 9 }),
    stored("y", { input: { n: 4 }, at: 1 }),
  ]);
  ctx.clock.advance(10);
  const r = start(jobs, ctx);
  await settle();
  expect(ran).toEqual(["4", "1", "2", "3", "0"]);
  await r.end();
});

test("A signal that aborts while the first read is in flight starts no job, frees the lease and ends the run", async () => {
  const ctx = sim();
  let calls = 0;
  const jobs = queue({
    "orders.work": job({ input }, () => {
      calls++;
      return never();
    }),
  });
  await seed(ctx, [stored("a")]);
  const r = start(jobs, ctx);
  r.stop.abort();
  await r.run;
  await settle();
  expect(calls).toBe(0);
  expect((await state(ctx)).q).toMatchObject([{ id: "a", n: 1, l: 0 }]);
});

test("A signal that aborts on an empty queue ends the run, and one aborted before it starts starts nothing", async () => {
  const ctx = sim();
  const jobs = queue({ "orders.work": job({ input }, async () => ok(null)) });
  const a = start(jobs, ctx);
  a.stop.abort();
  await a.run;
  const done = new AbortController();
  done.abort();
  await seed(ctx, [stored("a")]);
  await jobs.run(ctx, done.signal);
  expect((await state(ctx)).q).toMatchObject([{ id: "a", n: 0, l: 0 }]);
});

test("A stopped runner aborts its running job's signal, frees only its own leases, and drops a result that comes after", async () => {
  const ctx = sim();
  let finish: (() => void) | undefined;
  let signal: AbortSignal | undefined;
  const jobs = queue({
    "orders.work": job({ input, timeoutMs: 5000 }, (_n, _c, sg) => {
      signal = sg;
      return new Promise((resolve) => {
        finish = () => resolve(ok(null));
      });
    }),
  });
  await seed(ctx, [stored("a"), stored("other", { at: 0, n: 1, l: 99_999 })]);
  const r = start(jobs, ctx);
  await settle();
  expect(signal?.aborted).toBe(false);
  await r.end();
  expect(signal?.aborted).toBe(true);
  const after = (await state(ctx)).q;
  expect(after.find((x) => x.id === "a")).toMatchObject({ n: 1, l: 0 });
  expect(after.find((x) => x.id === "other")).toMatchObject({ n: 1, l: 99_999 });
  finish?.();
  await settle();
  expect((await state(ctx)).q.map((x) => x.id)).toEqual(["a", "other"]);
});

test("A runner whose queue holds nothing due writes nothing", async () => {
  const ctx = sim();
  let commits = 0;
  const shared = ctx.storage;
  const storage: KeyValueStorage = {
    get: (k) => shared.get(k),
    set: (k, v) => shared.set(k, v),
    read: (keys) => shared.read(keys),
    commit: (writes) => {
      commits++;
      return shared.commit(writes);
    },
  };
  const counted: Ctx = { clock: ctx.clock, random: ctx.random, net: ctx.net, storage };
  const jobs = queue({ "orders.work": job({ input }, async () => ok(null)) });
  await seed(ctx, [stored("a", { at: 500 })]);
  const r = start(jobs, counted);
  await settle();
  expect(commits).toBe(0);
  ctx.clock.advance(500);
  await settle();
  expect(commits).toBeGreaterThan(0);
  await r.end();
});

test("An enqueue wakes an idle runner without the clock moving", async () => {
  const ctx = sim();
  const ran: number[] = [];
  const jobs = queue({
    "orders.work": job({ input }, async ({ n }) => {
      ran.push(n);
      return ok(null);
    }),
  });
  const r = start(jobs, ctx);
  await settle();
  expect((await jobs.enqueue(ctx, "orders.work", { n: 7 })).ok).toBe(true);
  await settle();
  expect(ran).toEqual([7]);
  await r.end();
});

test("For any timing of a running job's result against an enqueue, every job runs", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 0, max: 60 }), async (lag) => {
      const ctx = sim();
      const ran: number[] = [];
      const gates: (() => void)[] = [];
      const jobs = queue({
        "orders.work": job({ input }, ({ n }) => {
          ran.push(n);
          return new Promise((resolve) => {
            gates.push(() => resolve(ok(null)));
          });
        }),
      });
      const r = start(jobs, ctx);
      expect((await jobs.enqueue(ctx, "orders.work", { n: 1 })).ok).toBe(true);
      await settle();
      expect((await jobs.enqueue(ctx, "orders.work", { n: 2 })).ok).toBe(true);
      await turns(lag);
      gates[0]?.();
      await settle();
      gates[1]?.();
      await settle();
      expect(ran).toEqual([1, 2]);
      expect((await state(ctx)).q).toEqual([]);
      await r.end();
    }),
    { seed: SEED, numRuns: 40 },
  );
});

test("The last 1,000 finished keys are kept, oldest first out, whether the job ended ok or failed", async () => {
  const ctx = sim();
  const old = Array.from({ length: 1000 }, (_, i) => ({ k: `old-${i}`, id: `done-${i}` }));
  const jobs = queue({
    "orders.work": job({ input, attempts: 1 }, async ({ n }) =>
      n === 0 ? ok(null) : err({ code: "orders.down", message: "down", data: {} }),
    ),
  });
  await seed(ctx, [stored("a", { key: "new-a" }), stored("b", { key: "new-b", input: { n: 1 }, at: 1 })], old);
  ctx.clock.advance(1);
  const r = start(jobs, ctx);
  await settle();
  await r.end();
  const { done, q } = await state(ctx);
  expect(q).toEqual([]);
  expect(done.length).toBe(1000);
  expect(done[0]).toEqual({ k: "old-2", id: "done-2" });
  expect(done.slice(-2)).toEqual([
    { k: "new-a", id: "a" },
    { k: "new-b", id: "b" },
  ]);
});

test("The newest 100 failures are kept, oldest first out, and a failure carries no input", async () => {
  const ctx = sim();
  const old = Array.from({ length: 100 }, (_, i) => ({ id: `f-${i}`, job: "orders.work", code: "orders.down", at: i }));
  const jobs = queue({
    "orders.work": job({ input, attempts: 1 }, async () => err({ code: "orders.down", message: "down", data: {} })),
  });
  await seed(ctx, [stored("a")], [], old);
  const r = start(jobs, ctx);
  await settle();
  await r.end();
  const { failed } = await state(ctx);
  expect(failed.length).toBe(100);
  expect(failed[0]).toEqual({ id: "f-1", job: "orders.work", code: "orders.down", at: 1 });
  expect(failed.at(-1)).toEqual({ id: "a", job: "orders.work", code: "orders.down", at: 0 });
});

test("enqueue names the job id a queue lacks, and a refused input with its message, path and rule", async () => {
  const ctx = sim();
  const jobs = queue({
    "orders.work": job({ input: s.object({ a: s.object({ n: s.int() }) }) }, async () => ok(null)),
  });
  const wide: { enqueue(ctx: Ctx, id: string, input: unknown): Promise<unknown> } = jobs;
  const gone = await wide.enqueue(ctx, "orders.gone", { n: 1 }).catch((e: unknown) => e);
  expect(isDefect(gone)).toBe(true);
  expect(Reflect.get(Object(gone), "data")).toEqual({ job: "orders.gone" });
  const bad: { a: { n: number } } = { a: { n: 1.5 } };
  const r = await jobs.enqueue(ctx, "orders.work", bad);
  expect(r).toEqual({ ok: false, error: { code: "keel.fields", message: "keel.fields", data: { "a.n": "int" } } });
});

test("An enqueued job's id is the ctx's next Job id, and its key is stored with it", async () => {
  const ctx = sim();
  const jobs = queue({ "orders.work": job({ input }, async () => ok(null)) });
  const r = await jobs.enqueue(ctx, "orders.work", { n: 1 }, { key: "k1" });
  expect(r).toEqual({ ok: true, value: sim().random.id("Job") });
  expect((await state(ctx)).q).toMatchObject([{ key: "k1", n: 0, l: 0 }]);
  const plain = await jobs.enqueue(ctx, "orders.work", { n: 2 });
  expect((await state(ctx)).q.find((x) => plain.ok && x.id === plain.value)).not.toHaveProperty("key");
});

test("A queue refuses an input holding s.secret naming the job and the path, and an empty table is a queue of module ''", async () => {
  const root = job({ input: s.secret(s.string()) }, async () => ok(null));
  expect(dataOf(() => queue({ "orders.a": root }))).toEqual({ job: "orders.a", at: "(root)" });
  const nested = job({ input: s.object({ pw: s.secret(s.string()) }) }, async () => ok(null));
  expect(dataOf(() => queue({ "orders.b": nested }))).toEqual({ job: "orders.b", at: "pw" });
  const ctx = sim();
  const empty = queue({});
  const r = start(empty, ctx);
  await settle();
  await r.end();
  expect(await ctx.storage.get("std.jobs.")).not.toBeNull();
  const dotted = queue({ "orders.a.b": job({ input }, async () => ok(null)) });
  expect((await dotted.enqueue(ctx, "orders.a.b", { n: 1 })).ok).toBe(true);
  expect(await ctx.storage.get(KEY)).not.toBeNull();
});
