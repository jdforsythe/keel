// @vitest-environment happy-dom
// Spec: k.drive, Conformance "In an empty replay, a scenario that awaits `ctx.clock.after(500)` and calls no `run` resolves, with `ctx.clock.now()` 500 after the await."
// Spec: k.drive, Conformance "In an empty replay, a scenario that starts a `ctx.clock.after(1000)` waiter, then awaits `ctx.clock.after(100)` and after it `ctx.clock.after(200)`: after the second await `ctx.clock.now()` is 300 and the 1,000 ms waiter has not resolved."
// Spec: k.drive, Conformance "In an empty replay, with waiters at 100, 200 and 300 ms each recording `ctx.clock.now()` as it resolves: after `await run(250)` the record is `[100, 200]` and the clock 250; after a following `await run(0)`, the same; after a following `await run()`, `[100, 200, 300]` and the clock 300."
// Spec: k.drive, Conformance "In an empty replay with `horizon: 0`, a scenario with waiters at 50 and 200 ms that calls `ctx.clock.advance(100)` then `await run()`: the clock is 100, the 50 ms waiter has resolved and the 200 ms one has not."
// Spec: k.drive, Conformance "A capability registered with a `sim` factory whose `work()` returns `hold('probe', () => p)`, `p` resolving when a `MessagePort` made before `simulate` delivers a message the test posts after 50 macrotask turns: in an empty replay, a scenario that starts a `ctx.clock.after(10)` waiter and awaits `work()` sees `ctx.clock.now()` 0 when `work()` answers and the 10 ms waiter not resolved."
// Spec: k.drive, Conformance "In an empty replay, with a `ctx.clock.after(100)` waiter pending, `fire` on a `render` handle on the run's ctx whose handler runs a transaction and waits on no clock resolves with `ctx.clock.now()` 0."
// Spec: k.sim, simulate "`run(ms?)` waits while the drive (k.drive) moves the clock: `run()` resolves once the run is idle, no `ctx.net` route of it is unanswered, and no moment is within the horizon, so no window edge within the horizon is left ahead of the clock; `run(ms)`, `ms` an integer 0 to 600000, takes each moment at or before `t + ms` (`t` the clock when called; the horizon does not bound it), then advances the clock to `t + ms` if it is earlier, and resolves once the run is idle with no `ctx.net` route unanswered. `run(0)` moves no clock. Another `ms` rejects with `schema.invalid`, failing the run."
// Spec: k.drive, Driving "A harness call moves no clock itself; under `simulate` it resolves only on a drive turn where no work of the run is pending but harness calls in progress, itself among them."
// Spec: k.drive, Driving "a harness `fire`, `settle`, `navigate` or render in progress, but not while it waits only on an unanswered `ctx.net` route."
// Spec: k.drive, Driving "No count of quiet rounds or busy turns decides anything under `simulate`."
// Spec: k.drive, Driving "`simulate` (k.sim) runs each scenario inside the run's async context (Node `AsyncLocalStorage` and an `async_hooks` hook, in `@keel/testing`; `@keel/ctx` imports no Node module and a sim ctx outside `simulate` is never driven)."
// Spec: k.drive, Driving "A scenario awaiting work that waits on the clock gets its answer at the first moment it can, with no `run()` call; code after an `await` that needs no clock runs at that `await`'s time; after `run(ms)` the run's state at `t + ms` is readable, work parked across it included."
// Spec: k.drive, Driving "`horizon: 0` leaves every later moment to the scenario's `advance`."
// Seed: 1337 (fc.assert below); replays use a SimRun of seed 1 and an empty schedule. The held work of the probe answers through a MessagePort made before `simulate`; the test's own MessageChannel turns stand for real I/O and no timer is used.
// ASSUMPTION: a waiter "resolved" is seen when its `.then` runs, after the scenario's next await; `run(ms)` with ms outside 0..600000 or non-integer rejects the run, so `simulate` rejects.
// ASSUMPTION: the clock stays where the test put it for a sim ctx outside `simulate` ("never driven"): the last case reads that through a harness `fire`.
import { MessageChannel } from "node:worker_threads";
import type { SimCtx } from "@keel/ctx";
import { register } from "@keel/ctx";
import { render, simulate } from "@keel/testing";
import fc from "fast-check";
import { expect, test } from "vitest";
import { CartView, SEED, cart, codeOf, simCtx, thrown } from "./fixtures.ts";

const replay = { seed: 1, schedule: { net: [], storage: [], offline: [], plans: {} } };

/** A waiter of the run's clock that records `now()` when it resolves; `stop` aborts it. */
function waiter(ctx: SimCtx, ms: number, record: number[] = []) {
  const ac = new AbortController();
  const state = { resolved: false };
  const done = ctx.clock.after(ms, ac.signal).then(
    () => {
      state.resolved = true;
      record.push(ctx.clock.now());
    },
    () => undefined,
  );
  return { state, done, record, stop: () => ac.abort() };
}

function turns(n: number): Promise<void> {
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    let i = 0;
    ch.port1.on("message", () => {
      i += 1;
      if (i >= n) {
        ch.port1.close();
        resolve();
      } else ch.port2.postMessage(0);
    });
    ch.port2.postMessage(0);
  });
}

type Probe = { work(): Promise<void> };
/** The port made before `simulate`; `answerAfter(n)` posts to it from the test after `n` macrotask turns of the test's own. */
let outside = new MessageChannel();
const probe = register("simDriveProbe", {
  real: (): Probe => ({ work: () => Promise.resolve() }),
  shell: (): Probe => ({ work: () => Promise.resolve() }),
  sim: ({ hold }): Probe => ({
    work: () =>
      hold(
        "probe",
        () =>
          new Promise<void>((resolve) => {
            outside.port1.once("message", () => resolve());
          }),
      ),
  }),
});

function answerAfter(n: number): void {
  outside = new MessageChannel();
  const port = outside.port2;
  void turns(n).then(() => port.postMessage(0));
}

function closeOutside(): void {
  outside.port1.close();
  outside.port2.close();
}

test("Under `simulate` with `replay` of a `SimRun` of seed 1 and an empty schedule, a scenario that awaits `ctx.clock.after(500)` and calls no `run` resolves, with `ctx.clock.now()` 500 after the await.", async () => {
  let now = -1;
  await simulate(
    async ({ ctx }) => {
      await ctx.clock.after(500);
      now = ctx.clock.now();
    },
    { replay },
  );
  expect(now).toBe(500);
});

test("a scenario that awaits `ctx.clock.after(ms)` and calls no `run` sees `ctx.clock.now()` equal to `ms`, for any `ms` within the horizon", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 600_000 }), async (ms) => {
      let now = -1;
      await simulate(
        async ({ ctx }) => {
          await ctx.clock.after(ms);
          now = ctx.clock.now();
        },
        { replay },
      );
      expect(now).toBe(ms);
    }),
    { seed: SEED, numRuns: 25 },
  );
});

test("Under `simulate` with `replay` of a `SimRun` of seed 1 and an empty schedule, a scenario that starts a `ctx.clock.after(1000)` waiter, then awaits `ctx.clock.after(100)` and after it `ctx.clock.after(200)`: after the second await `ctx.clock.now()` is 300 and the 1,000 ms waiter has not resolved.", async () => {
  const seen: { now: number; late: boolean }[] = [];
  await simulate(
    async ({ ctx }) => {
      const late = waiter(ctx, 1000);
      await ctx.clock.after(100);
      await ctx.clock.after(200);
      seen.push({ now: ctx.clock.now(), late: late.state.resolved });
      late.stop();
      await late.done;
    },
    { replay },
  );
  expect(seen).toEqual([{ now: 300, late: false }]);
});

test("a scenario that awaits a chain of `ctx.clock.after` waits sees the sum of them, and a longer waiter started first has not resolved", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(fc.integer({ min: 1, max: 500 }), { minLength: 1, maxLength: 6 }), async (steps) => {
      const total = steps.reduce((a, b) => a + b, 0);
      const seen: { now: number; late: boolean }[] = [];
      await simulate(
        async ({ ctx }) => {
          const late = waiter(ctx, total + 1);
          for (const ms of steps) await ctx.clock.after(ms);
          seen.push({ now: ctx.clock.now(), late: late.state.resolved });
          late.stop();
          await late.done;
        },
        { replay },
      );
      expect(seen).toEqual([{ now: total, late: false }]);
    }),
    { seed: SEED, numRuns: 25 },
  );
});

test("Under `simulate` with `replay` of a `SimRun` of seed 1 and an empty schedule, with waiters at 100, 200 and 300 ms each recording `ctx.clock.now()` as it resolves: after `await run(250)` the record is `[100, 200]` and the clock 250; after a following `await run(0)`, the same; after a following `await run()`, `[100, 200, 300]` and the clock 300.", async () => {
  const seen: { record: number[]; now: number }[] = [];
  await simulate(
    async ({ ctx, run }) => {
      const record: number[] = [];
      for (const ms of [100, 200, 300]) waiter(ctx, ms, record);
      await run(250);
      seen.push({ record: [...record], now: ctx.clock.now() });
      await run(0);
      seen.push({ record: [...record], now: ctx.clock.now() });
      await run();
      seen.push({ record: [...record], now: ctx.clock.now() });
    },
    { replay },
  );
  expect(seen).toEqual([
    { record: [100, 200], now: 250 },
    { record: [100, 200], now: 250 },
    { record: [100, 200, 300], now: 300 },
  ]);
});

test("`run(ms)` takes each waiter due at or before `t + ms`, leaves later ones, and sets the clock to `t + ms`, for generated deadlines and `ms`", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(fc.integer({ min: 1, max: 2000 }), { minLength: 1, maxLength: 8 }),
      fc.integer({ min: 0, max: 2500 }),
      async (deadlines, ms) => {
        const seen: { record: number[]; now: number }[] = [];
        await simulate(
          async ({ ctx, run }) => {
            const record: number[] = [];
            for (const d of deadlines) waiter(ctx, d, record);
            await run(ms);
            seen.push({ record: [...record], now: ctx.clock.now() });
            await run();
            seen.push({ record: [...record], now: ctx.clock.now() });
          },
          { replay },
        );
        const sorted = [...deadlines].sort((a, b) => a - b);
        expect(seen[0]).toEqual({ record: sorted.filter((d) => d <= ms), now: ms });
        expect(seen[1]?.record).toEqual(sorted);
        expect(seen[1]?.now).toBe(Math.max(ms, sorted[sorted.length - 1] ?? 0));
      },
    ),
    { seed: SEED, numRuns: 25 },
  );
});

test("`run(ms)` is not bounded by the horizon, and `run(0)` moves no clock", async () => {
  const seen: number[] = [];
  await simulate(
    async ({ ctx, run }) => {
      const w = waiter(ctx, 5000);
      await run(0);
      seen.push(ctx.clock.now());
      await run(6000);
      seen.push(ctx.clock.now(), w.state.resolved ? 1 : 0);
    },
    { replay, horizon: 1000 },
  );
  expect(seen).toEqual([0, 6000, 1]);
});

test("`run(ms)` with an `ms` that is not an integer from 0 to 600000 rejects with `schema.invalid`, failing the run", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.oneof(
        fc.integer({ min: -1000, max: -1 }),
        fc.integer({ min: 600_001, max: 2_000_000 }),
        fc.constant(1.5),
        fc.constant(Number.NaN),
      ),
      async (bad) => {
        let rejection: unknown;
        const e = await thrown(() =>
          simulate(
            async ({ run }) => {
              try {
                await run(bad);
              } catch (r) {
                rejection = r;
                throw r;
              }
            },
            { replay },
          ),
        );
        expect(codeOf(e)).toBe("E1704");
        expect(codeOf(rejection)).toBe("schema.invalid");
      },
    ),
    { seed: SEED, numRuns: 15 },
  );
});

test("Under `simulate` with `replay` of a `SimRun` of seed 1 and an empty schedule and `horizon: 0`, a scenario with waiters at 50 and 200 ms that calls `ctx.clock.advance(100)` then `await run()`: the clock is 100, the 50 ms waiter has resolved and the 200 ms one has not.", async () => {
  const seen: { now: number; early: boolean; late: boolean }[] = [];
  await simulate(
    async ({ ctx, run }) => {
      const early = waiter(ctx, 50);
      const late = waiter(ctx, 200);
      await ctx.clock.advance(100);
      await run();
      seen.push({ now: ctx.clock.now(), early: early.state.resolved, late: late.state.resolved });
      late.stop();
      await late.done;
    },
    { replay, horizon: 0 },
  );
  expect(seen).toEqual([{ now: 100, early: true, late: false }]);
});

test("A capability registered with a `sim` factory whose `work()` returns `hold('probe', () => p)`, `p` resolving when a `MessagePort` made before `simulate` delivers a message the test posts after 50 macrotask turns: in an empty replay, a scenario that starts a `ctx.clock.after(10)` waiter and awaits `work()` sees `ctx.clock.now()` 0 when `work()` answers and the 10 ms waiter not resolved.", async () => {
  answerAfter(50);
  const seen: { now: number; waiter: boolean }[] = [];
  await simulate(
    async ({ ctx }) => {
      const w = waiter(ctx, 10);
      await probe(ctx).work();
      seen.push({ now: ctx.clock.now(), waiter: w.state.resolved });
      w.stop();
      await w.done;
    },
    { replay },
  );
  closeOutside();
  expect(seen).toEqual([{ now: 0, waiter: false }]);
});

test("held work answering through a port made before `simulate`, after any number of macrotask turns, answers at clock time 0 with a pending 10 ms waiter not resolved", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 300 }), async (n) => {
      answerAfter(n);
      const seen: { now: number; waiter: boolean }[] = [];
      await simulate(
        async ({ ctx }) => {
          const w = waiter(ctx, 10);
          await probe(ctx).work();
          seen.push({ now: ctx.clock.now(), waiter: w.state.resolved });
          w.stop();
          await w.done;
        },
        { replay },
      );
      closeOutside();
      expect(seen).toEqual([{ now: 0, waiter: false }]);
    }),
    { seed: SEED, numRuns: 10 },
  );
});

test("Under `simulate` with `replay` of a `SimRun` of seed 1 and an empty schedule, with a `ctx.clock.after(100)` waiter pending, `fire` on a `render` handle on the run's ctx whose handler runs a transaction and waits on no clock resolves with `ctx.clock.now()` 0.", async () => {
  const seen: { now: number; waiter: boolean; items: number }[] = [];
  await simulate(
    async ({ ctx }) => {
      const w = waiter(ctx, 100);
      const t = render(CartView, { props: { compact: false }, state: [[cart, { items: [] }]], ctx });
      await t.fire("cart.add", { type: "click" });
      seen.push({ now: ctx.clock.now(), waiter: w.state.resolved, items: t.state(cart).items.length });
      t.dispose();
      w.stop();
      await w.done;
    },
    { replay },
  );
  expect(seen).toEqual([{ now: 0, waiter: false, items: 1 }]);
});

test("a harness call moves no clock itself: `fire` on a plain sim ctx outside `simulate` with a pending waiter leaves the clock where the test put it", async () => {
  // Outside `simulate` the clock is the test's: a sim ctx outside `simulate` is never driven (k.drive Driving).
  const ctx = simCtx();
  const w = waiter(ctx, 100);
  const t = render(CartView, { props: { compact: false }, state: [[cart, { items: [] }]], ctx });
  await t.fire("cart.add", { type: "click" });
  expect(ctx.clock.now()).toBe(0);
  expect(w.state.resolved).toBe(false);
  t.dispose();
  w.stop();
  await w.done;
});
