// @vitest-environment happy-dom
// Spec: k.sim, Conformance "A scenario that starts ten waiters `ctx.clock.after(Math.floor(ctx.random.float() * 1000))`, each recording its index and `ctx.clock.now()` as it resolves, then awaits `run()`: under `simulate` with `{ runs: 20, seed: 7 }` each run's record lists all ten ordered by time, ties by index, and `replay` of the `SimRun` that run received records an equal list."
// Spec: k.sim, Law "The drive draws no random and reads no real time. Two runs of one `SimRun` and one scenario whose effects go through the run's ctx, its real I/O held, take the same moments in the same order and report the same observer events (k.ctx) in the same order at the same `ctx.clock.now()`, ending with equal store snapshots. Work the run cannot see (a file read, an `import()` no harness call is loading, a timer) is outside the law."
// Seed: 1337 (fc.assert below); the ten-waiter clause runs under `simulate` seed 7.
// ASSUMPTION: "moments in the same order" is observed as the clock time at which each scenario-visible completion (waiter, save, net call) is seen, in completion order; "store snapshots" are read as the final values of the keys the scenario wrote to `ctx.storage` (a `get` takes a storage step like any other, so the read is part of the run); observer events are the `net` events of the schedule's offline windows.
import type { Schedule, SimCtx } from "@keel/ctx";
import { observe } from "@keel/ctx";
import { simulate } from "@keel/testing";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED } from "./fixtures.ts";

test("A scenario that starts ten waiters `ctx.clock.after(Math.floor(ctx.random.float() * 1000))`, each recording its index and `ctx.clock.now()` as it resolves, then awaits `run()`: under `simulate` with `{ runs: 20, seed: 7 }` each run's record lists all ten ordered by time, ties by index, and `replay` of the `SimRun` that run received records an equal list.", async () => {
  type Rec = { i: number; t: number };
  const scenario = async (record: Rec[], ctx: SimCtx, run: () => Promise<void>) => {
    for (let i = 0; i < 10; i++) {
      void ctx.clock.after(Math.floor(ctx.random.float() * 1000)).then(() => {
        record.push({ i, t: ctx.clock.now() });
      });
    }
    await run();
  };
  const runs: { simRun: { seed: number; schedule: Schedule }; record: Rec[] }[] = [];
  await simulate(
    async ({ ctx, run, seed, schedule }) => {
      const record: Rec[] = [];
      await scenario(record, ctx, run);
      runs.push({ simRun: { seed, schedule }, record });
    },
    { runs: 20, seed: 7 },
  );
  expect(runs).toHaveLength(20);
  for (const { simRun, record } of runs) {
    expect(record).toHaveLength(10);
    expect(new Set(record.map((r) => r.i)).size).toBe(10);
    const sorted = [...record].sort((a, b) => a.t - b.t || a.i - b.i);
    expect(record).toEqual(sorted);
    let again: Rec[] = [];
    await simulate(
      async ({ ctx, run }) => {
        const r: Rec[] = [];
        await scenario(r, ctx, run);
        again = r;
      },
      { replay: simRun },
    );
    expect(again).toEqual(record);
  }
});

type Op =
  | { k: "wait"; at: number }
  | { k: "save"; at: number; key: string; value: string }
  | { k: "net"; at: number; path: string };

const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc.record({ k: fc.constant("wait" as const), at: fc.integer({ min: 0, max: 800 }) }),
  fc.record({
    k: fc.constant("save" as const),
    at: fc.integer({ min: 0, max: 800 }),
    key: fc.constantFrom("a", "b", "c"),
    value: fc.string({ maxLength: 6 }),
  }),
  fc.record({
    k: fc.constant("net" as const),
    at: fc.integer({ min: 0, max: 800 }),
    path: fc.constantFrom("x", "y"),
  }),
);

const windowsArb = fc
  .array(fc.tuple(fc.integer({ min: 1, max: 300 }), fc.integer({ min: 1, max: 300 })), { maxLength: 3 })
  .map((gaps) => {
    const out: { at: number; ms: number }[] = [];
    let t = 0;
    for (const [gap, ms] of gaps) {
      out.push({ at: t + gap, ms });
      t += gap + ms;
    }
    return out;
  });

const scheduleArb: fc.Arbitrary<Schedule> = fc.record({
  net: fc.array(
    fc.record({
      delay: fc.integer({ min: 0, max: 400 }),
      fault: fc.constantFrom("none" as const, "drop" as const, "lost" as const, "unavailable" as const),
    }),
    { maxLength: 6 },
  ),
  storage: fc.array(fc.constantFrom("ok" as const, "fail" as const), { maxLength: 8 }),
  offline: windowsArb,
  plans: fc.constant({}),
});

type Outcome = {
  moves: [string, number][];
  events: { event: string; at: number }[];
  snapshot: (string | null)[];
  end: number;
};

async function runOnce(ops: Op[], simRun: { seed: number; schedule: Schedule }): Promise<Outcome> {
  const out: Outcome = { moves: [], events: [], snapshot: [], end: -1 };
  await simulate(
    async ({ ctx, run }) => {
      ctx.net.route("https://law.test/*", (req) => new Response(`ok ${new URL(req.url).pathname}`));
      observe(ctx, (e) => {
        out.events.push({ event: JSON.stringify(e), at: ctx.clock.now() });
      });
      const chains = ops.map(async (op, n) => {
        await ctx.clock.after(op.at);
        let tag: string = op.k;
        try {
          if (op.k === "save") await ctx.storage.set(op.key, op.value);
          if (op.k === "net") tag = `net:${(await ctx.net.fetch(new Request(`https://law.test/${op.path}`))).status}`;
        } catch {
          tag = `${op.k}:rejected`;
        }
        out.moves.push([`${n}:${tag}`, ctx.clock.now()]);
      });
      await Promise.all(chains);
      await run();
      for (const key of ["a", "b", "c"]) {
        try {
          out.snapshot.push(await ctx.storage.get(key));
        } catch {
          out.snapshot.push("get-failed");
        }
      }
      out.end = ctx.clock.now();
    },
    { replay: simRun },
  );
  return out;
}

test("Two runs of one `SimRun` and one scenario take the same moments in the same order, report the same observer events in the same order at the same `ctx.clock.now()`, and end with equal store snapshots, for generated scenarios of clock waits, saves and net calls", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(opArb, { minLength: 1, maxLength: 8 }),
      scheduleArb,
      fc.integer({ min: 0, max: 2 ** 32 - 1 }),
      async (ops, schedule, seed) => {
        const simRun = { seed, schedule };
        const first = await runOnce(ops, simRun);
        const second = await runOnce(ops, simRun);
        expect(second.moves).toEqual(first.moves);
        expect(second.events).toEqual(first.events);
        expect(second.snapshot).toEqual(first.snapshot);
        expect(second.end).toBe(first.end);
        expect(first.moves).toHaveLength(ops.length);
      },
    ),
    { seed: SEED, numRuns: 30 },
  );
});

test("the clock moves of a run are the waiters' deadlines in order: each scenario completion is seen at its wait's time or later, never earlier, and completions are seen in non-decreasing clock time", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(fc.integer({ min: 0, max: 800 }), { minLength: 1, maxLength: 8 }), async (waits) => {
      const ops: Op[] = waits.map((at) => ({ k: "wait", at }));
      const out = await runOnce(ops, { seed: 1, schedule: { net: [], storage: [], offline: [], plans: {} } });
      const times = out.moves.map(([, t]) => t);
      expect(times).toEqual([...waits].sort((a, b) => a - b));
    }),
    { seed: SEED, numRuns: 25 },
  );
});
