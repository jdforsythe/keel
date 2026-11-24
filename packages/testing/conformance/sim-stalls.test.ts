// @vitest-environment happy-dom
// Spec: k.drive, Conformance "In an empty replay, a scenario that awaits a promise nothing resolves, with no clock waiter, rejects `simulate` with E1704 whose first line holds `E1727 the scenario waits and nothing in the run is due`."
// Spec: k.drive, Conformance "In an empty replay with `horizon: 1000`, a scenario that awaits `ctx.clock.after(5000)` rejects `simulate` with E1704 whose first line holds `E1727 the scenario waits past the horizon: next deadline 5000 ms`, the clock at 0."
// Spec: k.drive, Conformance "A capability registered with a `sim` factory whose `work()` returns `hold('probe', () => new Promise(() => {}))`: in an empty replay, a scenario that awaits `work()` rejects `simulate`, after at least 10,000 ms of real time, with E1704 whose first line holds `E1728 work in flight never answered: probe`."
// Spec: k.drive, Conformance "A capability registered with a `sim` factory whose `work()` returns `hold('probe', () => ctx.clock.after(10))`: in an empty replay, a scenario that awaits `work()` rejects `simulate` with E1704 whose first line holds `E1728 held work waits on the sim clock: probe`."
// Spec: k.drive, Stalls "A scenario pending with no `run` call of it pending, when no work is pending and no moment is within its bound, fails the run on that turn with E1727 (k.testing), `the scenario waits past the horizon: next deadline <n> ms` when `ctx.clock.next()` is `n`, else `the scenario waits and nothing in the run is due`."
// Spec: k.drive, Stalls "A `ctx.clock.after` or an online wait made inside held work fails it at once with E1728 `held work waits on the sim clock: <label>`."
// Spec: k.drive, Stalls "Work pending through 10,000 ms of real time without settling fails it with E1728 `work in flight never answered: <label>`, `<label>` the held work's label, else the resource's Node type (`Timeout`, `PBKDF2REQUEST`, `TCPWRAP`)."
// Spec: k.drive, Stalls "That bound reads real time only to fail a run: it never moves the clock or changes a trace."
// Spec: k.testing, Rules "E1727 a `simulate` scenario waiting on nothing the run can move, E1728 held work waiting on the clock or work in flight that never answers (k.drive Stalls), E1729 two replays of a run whose traces differ (k.drive Law check)"
// Spec: k.sim, Failure "A failing run is shrunk (fewer steps, shorter delays, fewer faults and windows) and reported as E1704 (k.testing) with the seed, the run, and the shrunk `SimRun` as JSON on the next line."
// Seed: 1337 (fc.assert below); replays use a SimRun of seed 1 and an empty schedule.
// Timing: E1727 and the clock-wait E1728 are asserted to arrive in well under 10 s of real time (their bounds read no real time, so a machine's speed cannot move them); the cases that wait out the real-time bound take 10 s each and carry their own timeout.
// ASSUMPTION: "first line" is the message's first line; the E1704 line holds the stall text after the code. E1727 and E1728 are runtime codes (no `keel check` fixture), reached by the operator only as E1704.
// ASSUMPTION: a `ctx.net` route that awaits a promise nothing resolves is a promise alone, so a scenario awaiting its fetch is parked with nothing pending: E1727 `the scenario waits and nothing in the run is due` (the earlier "a ctx.net request" label no longer exists in the Stalls text).
// ASSUMPTION: a `setInterval` of `node:timers` made in the scenario and never cleared is the "resource's Node type" case: `Timeout`.
// UNTESTABLE: the online wait of the E1728 held-work sentence; no public API names an online wait (only `ctx.net.online()`, a read), so only the clock wait is asserted.
import { setImmediate, setInterval, setTimeout } from "node:timers";
import { register } from "@keel/ctx";
import type { SimCtx } from "@keel/ctx";
import { simulate } from "@keel/testing";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, codeOf, messageOf, thrown } from "./fixtures.ts";

const replay = { seed: 1, schedule: { net: [], storage: [], offline: [], plans: {} } };
const firstLine = (e: unknown): string => messageOf(e).split("\n")[0] ?? "";
/** Real milliseconds a call takes (`hrtime`: the only way to read that bound from outside; no `Date`); the stall bounds under test read no real time, so they stay far under this. */
const SOON = 5000;
const realMs = async (fn: () => Promise<unknown>): Promise<number> => {
  const start = process.hrtime.bigint();
  await fn();
  return Number(process.hrtime.bigint() - start) / 1e6;
};

type Probe = { work(ctx: SimCtx): Promise<void> };
const hung = register("simStallsProbe", {
  real: (): Probe => ({ work: () => Promise.resolve() }),
  shell: (): Probe => ({ work: () => Promise.resolve() }),
  sim: ({ hold }): Probe => ({ work: () => hold("probe", () => new Promise<void>(() => {})) }),
});
const clockHeld = register("simStallsClockHold", {
  real: (): Probe => ({ work: () => Promise.resolve() }),
  shell: (): Probe => ({ work: () => Promise.resolve() }),
  sim: ({ hold }): Probe => ({ work: (c) => hold("probe", () => c.clock.after(10)) }),
});
/** One capability per generated `ms` would register a name per run; this one reads `ms` from the scenario instead. */
let heldMs = 10;
const clockHeldAny = register("simStallsClockHoldAny", {
  real: (): Probe => ({ work: () => Promise.resolve() }),
  shell: (): Probe => ({ work: () => Promise.resolve() }),
  sim: ({ hold }): Probe => ({ work: (c) => hold("probe", () => c.clock.after(heldMs)) }),
});

test("In an empty replay, a scenario that awaits a promise nothing resolves, with no clock waiter, rejects `simulate` with E1704 whose first line holds `E1727 the scenario waits and nothing in the run is due`.", async () => {
  const e = await thrown(() =>
    simulate(
      async () => {
        await new Promise<void>(() => {});
      },
      { replay },
    ),
  );
  expect(codeOf(e)).toBe("E1704");
  expect(firstLine(e)).toContain("E1727 the scenario waits and nothing in the run is due");
});

test("In an empty replay with `horizon: 1000`, a scenario that awaits `ctx.clock.after(5000)` rejects `simulate` with E1704 whose first line holds `E1727 the scenario waits past the horizon: next deadline 5000 ms`, the clock at 0.", async () => {
  let seen: SimCtx | undefined;
  const e = await thrown(() =>
    simulate(
      async ({ ctx }) => {
        seen = ctx;
        await ctx.clock.after(5000);
      },
      { replay, horizon: 1000 },
    ),
  );
  expect(codeOf(e)).toBe("E1704");
  expect(firstLine(e)).toContain("E1727 the scenario waits past the horizon: next deadline 5000 ms");
  expect(seen?.clock.now()).toBe(0);
});

test("a scenario awaiting a `ctx.clock.after(d)` past a generated `horizon` fails E1727 naming `next deadline d ms` with the clock at 0, `horizon: 0` included", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 0, max: 3000 }), fc.integer({ min: 1, max: 5000 }), async (horizon, extra) => {
      const d = horizon + extra;
      let seen: SimCtx | undefined;
      const e = await thrown(() =>
        simulate(
          async ({ ctx }) => {
            seen = ctx;
            await ctx.clock.after(d);
          },
          { replay, horizon },
        ),
      );
      expect(codeOf(e)).toBe("E1704");
      expect(firstLine(e)).toContain(`E1727 the scenario waits past the horizon: next deadline ${d} ms`);
      expect(seen?.clock.now()).toBe(0);
    }),
    { seed: SEED, numRuns: 8 },
  );
});

test("A scenario pending with no `run` call of it pending, when no work is pending and no moment is within its bound, fails the run on that turn: a scenario waiting on nothing fails E1727 within real seconds, long before the 10,000 ms bound", async () => {
  const took = await realMs(async () => {
    const e = await thrown(() =>
      simulate(
        async () => {
          await new Promise<void>(() => {});
        },
        { replay },
      ),
    );
    expect(firstLine(e)).toContain("E1727");
  });
  expect(took).toBeLessThan(SOON);
});

test("E1727 fires on the first turn where nothing is pending and the scenario is still pending, with no grace: once its real work has ended, for any real duration of a timer and any number of immediates", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 0, max: 30 }), fc.integer({ min: 0, max: 5 }), async (ms, hops) => {
      let ended = false;
      const e = await thrown(() =>
        simulate(
          async () => {
            setTimeout(() => {
              ended = true;
            }, ms);
            for (let i = 0; i < hops; i++) setImmediate(() => undefined);
            await new Promise<void>(() => {});
          },
          { replay },
        ),
      );
      expect(codeOf(e)).toBe("E1704");
      expect(firstLine(e)).toContain("E1727 the scenario waits and nothing in the run is due");
      expect(ended).toBe(true);
    }),
    { seed: SEED, numRuns: 10 },
  );
});

test("a `ctx.net` route nothing answers is a promise alone: a scenario awaiting its fetch is parked with nothing pending, so E1727 `the scenario waits and nothing in the run is due`", async () => {
  const e = await thrown(() =>
    simulate(
      async ({ ctx }) => {
        ctx.net.route("https://stall.test/*", () => new Promise<Response>(() => {}));
        await ctx.net.fetch(new Request("https://stall.test/a"));
      },
      { replay },
    ),
  );
  expect(codeOf(e)).toBe("E1704");
  expect(firstLine(e)).toContain("E1727 the scenario waits and nothing in the run is due");
});

test("A scenario awaiting `run()` is not failed while no moment is within the horizon: `run()` resolves with the clock where it was", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 0, max: 2000 }), fc.integer({ min: 1, max: 4000 }), async (horizon, extra) => {
      let now = -1;
      await simulate(
        async ({ ctx, run }) => {
          const ac = new AbortController();
          void ctx.clock.after(horizon + extra, ac.signal).catch(() => undefined);
          await run();
          now = ctx.clock.now();
          ac.abort();
        },
        { replay, horizon },
      );
      expect(now).toBe(0);
    }),
    { seed: SEED, numRuns: 10 },
  );
});

test("E1727 a `simulate` scenario waiting on nothing the run can move reaches the operator as E1704 with the shrunk `SimRun` as JSON on the next line", async () => {
  const e = await thrown(() =>
    simulate(
      async () => {
        await new Promise<void>(() => {});
      },
      { runs: 5, seed: SEED },
    ),
  );
  expect(codeOf(e)).toBe("E1704");
  const lines = messageOf(e).split("\n");
  expect(lines[0]).toContain("E1727");
  const json: unknown = JSON.parse(lines[1] ?? "");
  expect(json).toMatchObject({ seed: expect.any(Number), schedule: expect.any(Object) });
});

test(
  "A capability registered with a `sim` factory whose `work()` returns `hold('probe', () => new Promise(() => {}))`: in an empty replay, a scenario that awaits `work()` rejects `simulate`, after at least 10,000 ms of real time, with E1704 whose first line holds `E1728 work in flight never answered: probe`.",
  { timeout: 60_000 },
  async () => {
    let seen: SimCtx | undefined;
    let e: unknown;
    const took = await realMs(async () => {
      e = await thrown(() =>
        simulate(
          async ({ ctx }) => {
            seen = ctx;
            await hung(ctx).work(ctx);
          },
          { replay },
        ),
      );
    });
    expect(took).toBeGreaterThanOrEqual(10_000);
    expect(codeOf(e)).toBe("E1704");
    expect(firstLine(e)).toContain("E1728 work in flight never answered: probe");
    expect(seen?.clock.now()).toBe(0);
  },
);

test(
  "Work pending through 10,000 ms of real time without settling fails it with E1728 `work in flight never answered: <label>`, `<label>` the resource's Node type (`Timeout`) when no work is held: an interval the scenario never clears",
  { timeout: 60_000 },
  async () => {
    let handle: ReturnType<typeof setInterval> | undefined;
    const e = await thrown(() =>
      simulate(
        async ({ ctx }) => {
          handle = setInterval(() => undefined, 1_000_000);
          await ctx.clock.after(10);
        },
        { replay },
      ),
    );
    clearInterval(handle);
    expect(codeOf(e)).toBe("E1704");
    expect(firstLine(e)).toContain("E1728 work in flight never answered: Timeout");
  },
);

test(
  "E1728 reaches the operator as E1704 with the shrunk `SimRun` as JSON on the next line",
  { timeout: 60_000 },
  async () => {
    const e = await thrown(() =>
      simulate(
        async ({ ctx }) => {
          await hung(ctx).work(ctx);
        },
        { replay },
      ),
    );
    expect(codeOf(e)).toBe("E1704");
    const lines = messageOf(e).split("\n");
    expect(lines[0]).toContain("E1728");
    expect(JSON.parse(lines[1] ?? "")).toMatchObject({ schedule: expect.any(Object) });
  },
);

test("A capability registered with a `sim` factory whose `work()` returns `hold('probe', () => ctx.clock.after(10))`: in an empty replay, a scenario that awaits `work()` rejects `simulate` with E1704 whose first line holds `E1728 held work waits on the sim clock: probe`, at once", async () => {
  let e: unknown;
  const took = await realMs(async () => {
    e = await thrown(() =>
      simulate(
        async ({ ctx }) => {
          await clockHeld(ctx).work(ctx);
        },
        { replay },
      ),
    );
  });
  expect(codeOf(e)).toBe("E1704");
  expect(firstLine(e)).toContain("E1728 held work waits on the sim clock: probe");
  expect(took).toBeLessThan(SOON);
});

test("a `ctx.clock.after` of any duration made inside held work fails E1728 `held work waits on the sim clock: probe`, whatever the run's horizon", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 0, max: 5000 }), fc.integer({ min: 0, max: 5000 }), async (ms, horizon) => {
      heldMs = ms;
      const e = await thrown(() =>
        simulate(
          async ({ ctx }) => {
            await clockHeldAny(ctx).work(ctx);
          },
          { replay, horizon },
        ),
      );
      expect(codeOf(e)).toBe("E1704");
      expect(firstLine(e)).toContain("E1728 held work waits on the sim clock: probe");
    }),
    { seed: SEED, numRuns: 6 },
  );
});
