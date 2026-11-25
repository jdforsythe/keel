// @vitest-environment happy-dom
// Spec: k.drive, Conformance "In an empty replay, a scenario that awaits a promise nothing resolves, with no clock waiter, rejects `simulate` with E1704 whose first line holds `E1727 the scenario waits and nothing in the run is due`."
// Spec: k.drive, Conformance "In an empty replay with `horizon: 1000`, a scenario that awaits `ctx.clock.after(5000)` rejects `simulate` with E1704 whose first line holds `E1727 the scenario waits past the horizon: next deadline 5000 ms`, the clock at 0."
// Spec: k.drive, Conformance "A capability registered with a `sim` factory whose `work()` returns `hold('probe', () => new Promise(() => {}))`: in an empty replay, a scenario that awaits `work()` under `budget: 300` rejects `simulate`, no sooner than 300 ms of real time after the call, with E1704 whose first line holds `E1728 the budget ran out with work in flight: probe`."
// Spec: k.drive, Conformance "A capability registered with a `sim` factory whose `work()` returns `hold('probe', () => ctx.clock.after(10))`: in an empty replay, a scenario that awaits `work()` rejects `simulate` with E1704 whose first line holds `E1728 held work waits on the sim clock: probe`."
// Spec: k.drive, Conformance "In an empty replay under `budget: 300`, a scenario that runs a loop of `node:timers` `setTimeout(1)` calls, each started when the previous answers, for 600 ms of real time, then awaits `run()`, rejects `simulate` with E1704 whose first line holds `E1728 the budget ran out with work in flight: Timeout`; the same loop for 100 ms resolves."
// Spec: k.drive, Conformance "In an empty replay under `budget: 300`, a scenario that awaits one `node:timers` `setTimeout(400)` rejects `simulate` with E1704 whose first line holds `E1728 the budget ran out with work in flight: Timeout`; one that awaits `setTimeout(100)` resolves."
// Spec: k.drive, Conformance "In an empty replay, a scenario that starts a `node:timers` `setTimeout(50)` recording that it ran and resolves without awaiting it resolves `simulate`, the record set; under `budget: 300`, one that starts a `setInterval` and resolves without clearing it rejects `simulate`, no sooner than 300 ms of real time after the call, with E1704 whose first line holds `E1728 work outlived the scenario: Timeout`; one that calls `clearInterval` on it before resolving resolves."
// Spec: k.drive, Conformance "A capability registered with a `sim` factory whose `work()` returns `hold('probe', () => new Promise(() => {}))`: in an empty replay under `budget: 300`, a scenario that calls `work()` without awaiting it and resolves rejects `simulate`, no sooner than 300 ms of real time after the call, with E1704 whose first line holds `E1728 work outlived the scenario: probe`; one that starts a `node:timers` `setInterval`, then calls `work()`, and resolves, clearing and awaiting neither, with `E1728 work outlived the scenario: Timeout, probe`."
// Spec: k.drive, Conformance "In a vitest test declaring a 2,000 ms timeout, an empty replay with no `budget` whose scenario awaits `work()` of a capability whose `work()` returns `hold('probe', () => new Promise(() => {}))` rejects `simulate` with E1704 whose first line holds `E1728 the budget ran out with work in flight: probe`, between 1,800 and 2,000 ms of real time after the test started."
// Spec: k.drive, Stalls "A scenario pending with no `run` call of it pending, when no work is pending and no moment is within its bound, fails the run on that turn with E1727 (k.testing), `the scenario waits past the horizon: next deadline <n> ms` when `ctx.clock.next()` is `n`, else `the scenario waits and nothing in the run is due`."
// Spec: k.drive, Stalls "A `ctx.clock.after` or an online wait made inside held work fails it at once with E1728 `held work waits on the sim clock: <label>`."
// Spec: k.drive, Stalls "`simulate` has a real-time *budget*: `simulate(scenario, { budget })` in ms, else the enclosing vitest test's timeout less a tenth of it (at least 50 ms), counted from the instant the runner starts the test (before its hooks), else 300,000 ms from the `simulate` call."
// Spec: k.drive, Stalls "When the budget is spent, the run in progress fails with E1728 `the budget ran out with work in flight: <labels>`, each pending piece's label (held work's label, else the resource's Node type: `Timeout`, `PBKDF2REQUEST`, `TCPWRAP`) oldest first, separated by `, `, or `none`; it is not shrunk or replayed."
// Spec: k.drive, Stalls "No piece of work has a bound of its own: endless short work is no stall, and the budget, the author's own bound, ends it."
// Spec: k.drive, Stalls "The budget reads real time only to fail a run: it never moves the clock or changes a trace."
// Spec: k.drive, Stalls "When the scenario resolves, the drive keeps taking its turns, moving no clock, until no work of the run is pending; when the budget is spent first, the run fails with E1728 `work outlived the scenario: <labels>`, labelled as above, in place of `the budget ran out`."
// Spec: k.drive, Stalls "A scenario closes what it opened (`app.close()`, `clearInterval`, a socket's `close`)."
// Spec: k.drive, Stalls "A scenario that rejects is reported with its own error."
// Spec: k.drive, Driving "Work that waits only on the sim clock or on the net's online state is promises alone and is never pending: it is *parked*, as is the request, job or route around it."
// Spec: k.testing, Rules "E1727 a `simulate` scenario waiting on nothing the run can move, E1728 held work waiting on the clock, work in flight that never answers, or work that outlives its scenario (k.drive Stalls), E1729 two replays of a run whose traces differ (k.drive-law)"
// Spec: k.sim, Failure "A failing run is shrunk (fewer steps, shorter delays, fewer faults and windows) and reported as E1704 (k.testing) with the seed, the run, and the shrunk `SimRun` as JSON on the next line."
// Seed: 1337 (fc.assert below); replays use a SimRun of seed 1 and an empty schedule.
// Timing: E1727 and the clock-wait E1728 are asserted to arrive in well under 5 s of real time (their bounds read no real time, so a machine's speed cannot move them); every budget case sets `budget: 300` and waits at most 600 ms of real time, the 2,000 ms case excepted; the file takes about 8 s on a right build (the 2,000 ms case and eleven 300 ms budget cases).
// ASSUMPTION: the budget's "labels" are separated by `, `; `labelsOf` splits on it and takes word characters only, so the operator's trailer after the labels is left out.
// ASSUMPTION: the "between 1,800 and 2,000 ms ... after the test started" case measures from the entry of the test body (the runner's own start precedes it by a few ms), so its lower bound is 1,800 less a 10 ms slack; its upper bound is the runner's own 2,000 ms timeout, raced by a 1,990 ms timer made outside the run, so a late E1728 fails with a message naming that, not the runner's.
// UNTESTABLE: the default budget of 300,000 ms from the `simulate` call (outside any vitest test) would take five minutes; and the `none` label list, since a run with nothing pending and a scenario unfinished is E1727 at once, and only a scenario that blocks the event loop past the budget could reach it, which the text leaves unsaid.
// ASSUMPTION: "first line" is the message's first line; the E1704 line holds the stall text after the code. E1727 and E1728 are runtime codes (no `keel check` fixture), reached by the operator only as E1704.
// ASSUMPTION: a `ctx.net` route that awaits a promise nothing resolves is a promise alone, so a scenario awaiting its fetch is parked with nothing pending: E1727 `the scenario waits and nothing in the run is due` (the earlier "a ctx.net request" label no longer exists in the Stalls text).
// ASSUMPTION: a `setInterval` of `node:timers` made in the scenario and never cleared is the "resource's Node type" case: `Timeout`.
// UNTESTABLE: the online wait of the E1728 held-work sentence; no public API names an online wait (only `ctx.net.online()`, a read), so only the clock wait is asserted.
import { clearInterval, clearTimeout, setImmediate, setInterval, setTimeout } from "node:timers";
import { register } from "@keel/ctx";
import type { SimCtx } from "@keel/ctx";
import { simulate } from "@keel/testing";
import { fixedTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, codeOf, messageOf, thrown } from "./fixtures.ts";

const BUDGET = 300;
const replay = { seed: 1, schedule: { net: [], storage: [], offline: [], plans: {} } };
const firstLine = (e: unknown): string => messageOf(e).split("\n")[0] ?? "";
/** Real milliseconds a call takes (`hrtime`: the only way to read that bound from outside; no `Date`); the stall bounds that read no real time stay far under this. */
const SOON = 5000;
const realMs = async (fn: () => Promise<unknown>): Promise<number> => {
  const start = process.hrtime.bigint();
  await fn();
  return Number(process.hrtime.bigint() - start) / 1e6;
};

/** The comma-separated labels after `E1728 the budget ran out with work in flight: ` on the first line, the operator's own trailer (the seed) left out. */
const labelsOf = (e: unknown): string[] => {
  const m = /E1728 the budget ran out with work in flight: (\w+(?:, \w+)*)/.exec(firstLine(e));
  return (m?.[1] ?? "").split(", ");
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

test("A scenario pending with no `run` call of it pending, when no work is pending and no moment is within its bound, fails the run on that turn: a scenario waiting on nothing fails E1727 within real seconds, with no budget in play", async () => {
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

test("A capability registered with a `sim` factory whose `work()` returns `hold('probe', () => new Promise(() => {}))`: in an empty replay, a scenario that awaits `work()` under `budget: 300` rejects `simulate`, no sooner than 300 ms of real time after the call, with E1704 whose first line holds `E1728 the budget ran out with work in flight: probe`.", async () => {
  let seen: SimCtx | undefined;
  let e: unknown;
  const took = await realMs(async () => {
    e = await thrown(() =>
      simulate(
        async ({ ctx }) => {
          seen = ctx;
          await hung(ctx).work(ctx);
        },
        { replay, budget: BUDGET },
      ),
    );
  });
  expect(took).toBeGreaterThanOrEqual(BUDGET);
  expect(codeOf(e)).toBe("E1704");
  expect(firstLine(e)).toContain("E1728 the budget ran out with work in flight: probe");
  expect(seen?.clock.now()).toBe(0);
});

test(
  "In a vitest test declaring a 2,000 ms timeout, an empty replay with no `budget` whose scenario awaits `work()` of a capability whose `work()` returns `hold('probe', () => new Promise(() => {}))` rejects `simulate` with E1704 whose first line holds `E1728 the budget ran out with work in flight: probe`, between 1,800 and 2,000 ms of real time after the test started.",
  // The 2,000 ms timeout is the clause's input: `simulate` takes its budget from it, so it does not scale.
  { timeout: fixedTime(2000) },
  async () => {
    const start = process.hrtime.bigint();
    const sinceStart = (): number => Number(process.hrtime.bigint() - start) / 1e6;
    const lateMark = Symbol("the runner's timeout came first");
    let arrivedAt = Number.POSITIVE_INFINITY;
    let lateTimer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<symbol>((resolve) => {
      lateTimer = setTimeout(() => resolve(lateMark), 1990);
    });
    const outcome = await Promise.race([
      thrown(() =>
        simulate(
          async ({ ctx }) => {
            await hung(ctx).work(ctx);
          },
          { replay },
        ),
      ).then((e) => {
        arrivedAt = sinceStart();
        return e;
      }),
      late,
    ]);
    clearTimeout(lateTimer);
    expect(outcome, "E1728 must arrive before the runner's own 2,000 ms timeout").not.toBe(lateMark);
    expect(codeOf(outcome)).toBe("E1704");
    expect(firstLine(outcome)).toContain("E1728 the budget ran out with work in flight: probe");
    expect(arrivedAt).toBeGreaterThanOrEqual(1800 - 10);
    expect(arrivedAt).toBeLessThan(2000);
  },
);

test("When the budget is spent, the run in progress fails with E1728 `the budget ran out with work in flight: <labels>`, each pending piece's label oldest first, comma-separated: a hold made before any number of timers lists `probe` then each `Timeout`", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 3 }), async (timers) => {
      const handles: ReturnType<typeof setTimeout>[] = [];
      const e = await thrown(() =>
        simulate(
          async ({ ctx }) => {
            void hung(ctx).work(ctx);
            for (let i = 0; i < timers; i++) handles.push(setTimeout(() => undefined, 1_000_000));
            await new Promise<void>(() => {});
          },
          { replay, budget: BUDGET },
        ),
      );
      for (const h of handles) clearTimeout(h);
      expect(codeOf(e)).toBe("E1704");
      expect(labelsOf(e)).toEqual(["probe", ...Array.from({ length: timers }, () => "Timeout")]);
    }),
    { seed: SEED, numRuns: 3 },
  );
});

test("each pending piece's label oldest first: a timer made before a hold lists `Timeout` then `probe`", async () => {
  let handle: ReturnType<typeof setTimeout> | undefined;
  const e = await thrown(() =>
    simulate(
      async ({ ctx }) => {
        handle = setTimeout(() => undefined, 1_000_000);
        void hung(ctx).work(ctx);
        await new Promise<void>(() => {});
      },
      { replay, budget: BUDGET },
    ),
  );
  clearTimeout(handle);
  expect(codeOf(e)).toBe("E1704");
  expect(labelsOf(e)).toEqual(["Timeout", "probe"]);
});

test("When the budget is spent, the run in progress fails with E1728 and is not shrunk or replayed: a scenario outlasting the budget is called once", async () => {
  let calls = 0;
  const e = await thrown(() =>
    simulate(
      async ({ ctx }) => {
        calls += 1;
        await hung(ctx).work(ctx);
      },
      { runs: 1, seed: 1, budget: BUDGET },
    ),
  );
  expect(codeOf(e)).toBe("E1704");
  expect(firstLine(e)).toContain("E1728 the budget ran out with work in flight: probe");
  expect(calls).toBe(1);
});

test("The budget reads real time only to fail a run: it never moves the clock or changes a trace: a passing scenario records the same moments under a `budget` and under none, and with `law: true` its two traces agree", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(fc.integer({ min: 0, max: 400 }), { minLength: 1, maxLength: 4 }), async (waits) => {
      const record = async (budget: number | undefined): Promise<number[]> => {
        const seen: number[] = [];
        await simulate(
          async ({ ctx }) => {
            for (const w of waits) {
              await ctx.clock.after(w);
              seen.push(ctx.clock.now());
            }
          },
          budget === undefined ? { replay, law: true } : { replay, law: true, budget },
        );
        return seen;
      };
      expect(await record(BUDGET)).toEqual(await record(undefined));
    }),
    { seed: SEED, numRuns: 10 },
  );
});

test("A resource still pending when the budget is spent is listed by its Node type (`Timeout`) when no work is held: an interval the scenario never clears, under `budget: 300`", async () => {
  let handle: ReturnType<typeof setInterval> | undefined;
  const e = await thrown(() =>
    simulate(
      async ({ ctx }) => {
        handle = setInterval(() => undefined, 1_000_000);
        await ctx.clock.after(10);
      },
      { replay, budget: BUDGET },
    ),
  );
  clearInterval(handle);
  expect(codeOf(e)).toBe("E1704");
  expect(firstLine(e)).toContain("E1728 the budget ran out with work in flight: Timeout");
});

test("E1728 reaches the operator as E1704 with the `SimRun` as JSON on the next line", async () => {
  const e = await thrown(() =>
    simulate(
      async ({ ctx }) => {
        await hung(ctx).work(ctx);
      },
      { replay, budget: BUDGET },
    ),
  );
  expect(codeOf(e)).toBe("E1704");
  const lines = messageOf(e).split("\n");
  expect(lines[0]).toContain("E1728");
  expect(JSON.parse(lines[1] ?? "")).toMatchObject({ schedule: expect.any(Object) });
});

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

// ---- E1728 budget (Conformance #18, #19) and work outliving the scenario (#21, #22) ----

test("In an empty replay under `budget: 300`, a scenario that runs a loop of `node:timers` `setTimeout(1)` calls, each started when the previous answers, for 600 ms of real time, then awaits `run()`, rejects `simulate` with E1704 whose first line holds `E1728 the budget ran out with work in flight: Timeout`; the same loop for 100 ms resolves.", async () => {
  const loop =
    (realMsToRun: number) =>
    async ({ run }: { run(): Promise<void> }): Promise<void> => {
      const start = process.hrtime.bigint();
      while (Number(process.hrtime.bigint() - start) / 1e6 < realMsToRun) {
        await new Promise<void>((resolve) => setTimeout(resolve, 1));
      }
      await run();
    };
  const e = await thrown(() => simulate(loop(600), { replay, budget: BUDGET }));
  expect(codeOf(e)).toBe("E1704");
  expect(firstLine(e)).toContain("E1728 the budget ran out with work in flight: Timeout");
  expect(await thrown(() => simulate(loop(100), { replay, budget: BUDGET }))).toBeUndefined();
});

test("In an empty replay under `budget: 300`, a scenario that awaits one `node:timers` `setTimeout(400)` rejects `simulate` with E1704 whose first line holds `E1728 the budget ran out with work in flight: Timeout`; one that awaits `setTimeout(100)` resolves.", async () => {
  const wait = (ms: number) => async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  };
  const e = await thrown(() => simulate(wait(400), { replay, budget: BUDGET }));
  expect(codeOf(e)).toBe("E1704");
  expect(firstLine(e)).toContain("E1728 the budget ran out with work in flight: Timeout");
  expect(await thrown(() => simulate(wait(100), { replay, budget: BUDGET }))).toBeUndefined();
});

test("No piece of work has a bound of its own: a single timer or a loop of short timers that ends inside the budget resolves, whatever its real length below the budget", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 0, max: 120 }), async (ms) => {
      const e = await thrown(() =>
        simulate(
          async () => {
            await new Promise<void>((resolve) => setTimeout(resolve, ms));
          },
          { replay, budget: 1000 },
        ),
      );
      expect(e).toBeUndefined();
    }),
    { seed: SEED, numRuns: 8 },
  );
});

test("In an empty replay, a scenario that starts a `node:timers` `setTimeout(50)` recording that it ran and resolves without awaiting it resolves `simulate`, the record set; under `budget: 300`, one that starts a `setInterval` and resolves without clearing it rejects `simulate`, no sooner than 300 ms of real time after the call, with E1704 whose first line holds `E1728 work outlived the scenario: Timeout`; one that calls `clearInterval` on it before resolving resolves.", async () => {
  let ran = false;
  const stray = await thrown(() =>
    simulate(
      async () => {
        setTimeout(() => {
          ran = true;
        }, 50);
      },
      { replay },
    ),
  );
  expect(stray).toBeUndefined();
  expect(ran).toBe(true);
  let handle: ReturnType<typeof setInterval> | undefined;
  let e: unknown;
  const took = await realMs(async () => {
    e = await thrown(() =>
      simulate(
        async () => {
          handle = setInterval(() => undefined, 1_000_000);
        },
        { replay, budget: BUDGET },
      ),
    );
  });
  clearInterval(handle);
  expect(took).toBeGreaterThanOrEqual(BUDGET);
  expect(codeOf(e)).toBe("E1704");
  expect(firstLine(e)).toContain("E1728 work outlived the scenario: Timeout");
  const closed = await thrown(() =>
    simulate(
      async () => {
        const h = setInterval(() => undefined, 1_000_000);
        clearInterval(h);
      },
      { replay, budget: BUDGET },
    ),
  );
  expect(closed).toBeUndefined();
});

test("a stray timer of any real duration the scenario leaves running resolves `simulate` once it has answered, with its callback run", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 200 }), async (ms) => {
      let ran = false;
      const e = await thrown(() =>
        simulate(
          async () => {
            setTimeout(() => {
              ran = true;
            }, ms);
          },
          { replay, budget: 2000 },
        ),
      );
      expect(e).toBeUndefined();
      expect(ran).toBe(true);
    }),
    { seed: SEED, numRuns: 8 },
  );
});

test("A capability registered with a `sim` factory whose `work()` returns `hold('probe', () => new Promise(() => {}))`: in an empty replay under `budget: 300`, a scenario that calls `work()` without awaiting it and resolves rejects `simulate`, no sooner than 300 ms of real time after the call, with E1704 whose first line holds `E1728 work outlived the scenario: probe`; one that starts a `node:timers` `setInterval`, then calls `work()`, and resolves, clearing and awaiting neither, with `E1728 work outlived the scenario: Timeout, probe`.", async () => {
  let e: unknown;
  const took = await realMs(async () => {
    e = await thrown(() =>
      simulate(
        async ({ ctx }) => {
          void hung(ctx).work(ctx);
        },
        { replay, budget: BUDGET },
      ),
    );
  });
  expect(took).toBeGreaterThanOrEqual(BUDGET);
  expect(codeOf(e)).toBe("E1704");
  expect(firstLine(e)).toContain("E1728 work outlived the scenario: probe");
  let handle: ReturnType<typeof setInterval> | undefined;
  const both = await thrown(() =>
    simulate(
      async ({ ctx }) => {
        handle = setInterval(() => undefined, 1_000_000);
        void hung(ctx).work(ctx);
      },
      { replay, budget: BUDGET },
    ),
  );
  clearInterval(handle);
  expect(codeOf(both)).toBe("E1704");
  expect(firstLine(both)).toContain("E1728 work outlived the scenario: Timeout, probe");
});

test("work outliving the scenario is labelled oldest first, separated by `, `: a hold made before an interval lists `probe, Timeout`, an interval before a hold `Timeout, probe`", async () => {
  const handles: ReturnType<typeof setInterval>[] = [];
  const holdFirst = await thrown(() =>
    simulate(
      async ({ ctx }) => {
        void hung(ctx).work(ctx);
        handles.push(setInterval(() => undefined, 1_000_000));
      },
      { replay, budget: BUDGET },
    ),
  );
  expect(firstLine(holdFirst)).toContain("E1728 work outlived the scenario: probe, Timeout");
  const timerFirst = await thrown(() =>
    simulate(
      async ({ ctx }) => {
        handles.push(setInterval(() => undefined, 1_000_000));
        void hung(ctx).work(ctx);
      },
      { replay, budget: BUDGET },
    ),
  );
  for (const h of handles) clearInterval(h);
  expect(firstLine(timerFirst)).toContain("E1728 work outlived the scenario: Timeout, probe");
});

test("parked pollers do not count as work outliving the scenario: a `ctx.clock.after` waiter and a `ctx.net` route nothing answers, left behind, let the scenario resolve", async () => {
  const e = await thrown(() =>
    simulate(
      async ({ ctx }) => {
        void ctx.clock.after(1000).catch(() => undefined);
        ctx.net.route("https://park.test/*", () => new Promise<Response>(() => {}));
        void ctx.net.fetch(new Request("https://park.test/a")).catch(() => undefined);
      },
      { replay },
    ),
  );
  expect(e).toBeUndefined();
});

test("A scenario that rejects is reported with its own error: a scenario that leaves a timer running and throws reports E1704 with its own message, not E1728", async () => {
  const e = await thrown(() =>
    simulate(
      async () => {
        setTimeout(() => undefined, 50);
        throw new Error("scenario's own failure");
      },
      { replay },
    ),
  );
  expect(codeOf(e)).toBe("E1704");
  expect(messageOf(e)).toContain("scenario's own failure");
  expect(firstLine(e)).not.toContain("E1728");
});
