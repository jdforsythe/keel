// @vitest-environment happy-dom
// Spec: k.drive-law, clause "Under `simulate` with `{ runs: 1, seed: 1, law: true }`, a scenario that awaits `ctx.clock.after(10 * k)`, `k` the count of its calls so far counting this one, rejects `simulate` with E1729 whose first line holds `two replays of the run differ at trace entry 0`."
// Spec: k.drive-law, clause "Under `simulate` with `{ runs: 1, seed: 1 }`, a scenario that awaits `ctx.clock.after(10 * k)`, `k` as above, then throws rejects `simulate` with E1729, not E1704; one that awaits `ctx.clock.after(10)` then throws rejects with E1704."
// Spec: k.drive-law, clause "Under `simulate` with `{ runs: 1, seed: 1, law: true }`, a scenario that sets storage key `n` to `String(k)`, `k` the count of its calls so far counting this one, and makes no other effect, rejects `simulate` with E1729 whose first line holds `two replays of the run differ at trace entry 0` and whose next two lines are `{\"kind\":\"storage\",\"key\":\"n\",\"value\":\"1\"}` and `{\"kind\":\"storage\",\"key\":\"n\",\"value\":\"2\"}`."
// Spec: k.drive-law, clause "With `process.env.KEEL_TEST` `'1'`, `simulate` with `{ runs: 1, seed: 1 }` of a scenario that awaits `ctx.clock.after(10 * k)`, `k` the count of its calls so far counting this one, and resolves rejects with E1729 whose first line holds `two replays of the run differ at trace entry 0`; with `law: false` added, or with `KEEL_TEST` unset and no `law`, it resolves `{ seed: 1, runs: 1, checked: 0 }`."
// Spec: k.drive-law, clause "Under `simulate` with `{ runs: 3, seed: 1, law: true }`, a scenario that appends `JSON.stringify({ seed, schedule })` to an array and awaits `ctx.clock.after(10)`: `simulate` resolves `{ seed: 1, runs: 3, checked: 3 }`, the array holds six entries, and its last three equal its first three in order."
// Spec: k.drive-law, clause "In an empty replay with `{ law: true, budget: 300 }`, a scenario that awaits a `node:timers` `setTimeout(200)` makes `simulate` resolve with `runs` 1 and `checked` 0, no sooner than 300 ms of real time after the call; with `budget: 1000`, `checked` is 1."
// Spec: k.drive-law, clause "In an empty replay with `law: true`, a scenario that counts its calls and throws rejects `simulate` with E1704 after exactly three calls; with `law: false`, the same."
// k.drive-law, Law check "`law` is on by default when `process.env.KEEL_TEST` is `'1'` as `simulate` is called (`keel test` sets it, k.testing), else off; `law: false` turns it off and `law: true` on, under `keel test` or not."
// k.drive-law, Law check "With `law` on, after the last run each run that passed is run a second time with its `SimRun`, in run order, and the two traces are compared: a run's outcome is the one it has with `law` off, and a replay's own outcome is not read, only its trace."
// k.drive-law, Law check "A failing run's shrunk `SimRun`, unless it failed with E1727 or E1728, is replayed twice before it is reported, whatever `law` is; each run tried while shrinking runs once."
// k.drive-law, Law check "The replays share the run's budget (k.drive Stalls): when it runs out during a replay, that replay is stopped and not compared, no later run is replayed, and `simulate` resolves."
// k.drive-law, Law check "`simulate` resolves `{ seed, runs, checked }`, `checked` the count of runs whose replay was compared (0 with `law` off)."
// k.drive-law, Law check "Two traces that differ, final values included, fail with E1729 (k.testing) `two replays of the run differ at trace entry <n>`, the two entries as JSON on the next two lines, in place of E1704."
// k.drive-law, Law "Under `keel test`, by construction, two runs of one `SimRun` and one scenario take the same moments in the same order and report the same observer events (k.ctx) in the same order at the same `ctx.clock.now()`, ending with equal store snapshots, unless a thing that escapes the drive (below) reaches the trace; the law check, on by default there, reports that as E1729."
// k.drive-law, Law "The run's trace ends with the final value of each storage key the run wrote, by key in code-unit order, then the snapshot of each live store (`stores()`), by id, its log entries without their `at`."
// k.drive-law, Law "Entries are `{ kind: 'moment', at }`, `{ kind: 'event', at, event }` (a `resource` event's `id`, a count of the process, written as the order the run first reported it in: `'1'`, `'2'`, ...), `{ kind: 'storage', key, value }`, `value` the stored string as stored, and `{ kind: 'store', id, value }`, `value` the store's snapshot with each log entry's `at` left out (a per-store counter no restore resets)."
// k.drive-law, Law "Four things escape the drive and can change a trace: a resource made before the run or outside its context (a worker started at import, a module-level timer, channel or `AsyncResource`), unless the work answering through it is held; an `import()` in app code other than a harness's `routes` loader, which the test runner answers over its own channel; state kept outside the run's stores from one run to the next; real asynchronous work made in the run outside every seam (k.drive), whose completions the drive does not deliver, running beside a hold or other such work (a `node:timers` timer, a file read, a socket's data)."
// k.drive-law, Law "The law check reports a difference only when `law` is on or on the replays of a failing run, and only when it reaches the trace."
// k.sim, simulate "`simulate(scenario, { runs = 100, seed?, horizon = 600000, replay?, law?, budget? })`, `budget` a positive integer of real ms (k.drive), `law` the law check (k.drive-law). Each run draws a `SimRun` `{ seed, schedule }` from fast-check, the schedule generated from `Schedule` and each registered `plan` schema, creates that sim ctx, and awaits `scenario({ ctx, seed, schedule, run })`."
// k.sim, simulate "The seed is `seed`, else `KEEL_SEED`, else 1337; success resolves `{ seed, runs, checked }` (k.drive-law)."
// k.testing, Rules "E1727 a `simulate` scenario waiting on nothing the run can move, E1728 held work waiting on the clock, work in flight that never answers, or work that outlives its scenario (k.drive Stalls), E1729 two replays of a run whose traces differ (k.drive-law)"
// Seed: 1337 (fc.assert below); the runs below use `simulate` seeds 1 and 7.
// ASSUMPTION: the escape the cases use is state kept outside the run's stores from one run to the next (the clause's `k`, a module-level counter); the other escapes (a reply through a channel made before the run that no capability holds, concurrent real asynchronous work outside every seam such as two `node:timers` timers, an `import()` in app code) race real time against the drive and have no stable trace difference to assert, so they are not tested.
// ASSUMPTION: "trace entry 0" is the first moment taken; the two entries on the next two lines are JSON that parse and differ, their keys not named by the spec.
// ASSUMPTION: "replayed twice" is counted in scenario calls: a failing run shrinks (any number of calls), then its shrunk SimRun is replayed twice, so a failing run calls the scenario at least three times; `law: true` calls it exactly twice per run.
import { setTimeout } from "node:timers";
import { simulate } from "@keel/testing";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, codeOf, messageOf, thrown } from "./fixtures.ts";

const lines = (e: unknown): string[] => messageOf(e).split("\n");

test("Under `simulate` with `{ runs: 1, seed: 1, law: true }`, a scenario that awaits `ctx.clock.after(10 * k)`, `k` the count of its calls so far counting this one, rejects `simulate` with E1729 whose first line holds `two replays of the run differ at trace entry 0`.", async () => {
  let k = 0;
  const e = await thrown(() =>
    simulate(
      async ({ ctx }) => {
        k += 1;
        await ctx.clock.after(10 * k);
      },
      { runs: 1, seed: 1, law: true },
    ),
  );
  expect(codeOf(e)).toBe("E1729");
  expect(lines(e)[0]).toContain("two replays of the run differ at trace entry 0");
});

test("Two traces that differ, final values included, fail with E1729 `two replays of the run differ at trace entry <n>`, the two entries as JSON on the next two lines", async () => {
  let k = 0;
  const e = await thrown(() =>
    simulate(
      async ({ ctx }) => {
        k += 1;
        await ctx.clock.after(10 * k);
      },
      { runs: 1, seed: 1, law: true },
    ),
  );
  const [, a, b] = lines(e);
  const left: unknown = JSON.parse(a ?? "");
  const right: unknown = JSON.parse(b ?? "");
  expect(left).not.toEqual(right);
});

test("a scenario made nondeterministic through state outside the run's stores fails E1729 at trace entry 0 for any base wait and any step, with `law: true`", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 0, max: 400 }), fc.integer({ min: 1, max: 50 }), async (base, step) => {
      let k = 0;
      const e = await thrown(() =>
        simulate(
          async ({ ctx }) => {
            k += 1;
            await ctx.clock.after(base + step * k);
          },
          { runs: 1, seed: 1, law: true },
        ),
      );
      expect(codeOf(e)).toBe("E1729");
      expect(lines(e)[0]).toContain("two replays of the run differ at trace entry 0");
    }),
    { seed: SEED, numRuns: 15 },
  );
});

test("Under `simulate` with `{ runs: 1, seed: 1 }`, a scenario that awaits `ctx.clock.after(10 * k)`, `k` as above, then throws rejects `simulate` with E1729, not E1704; one that awaits `ctx.clock.after(10)` then throws rejects with E1704.", async () => {
  let k = 0;
  const drifting = await thrown(() =>
    simulate(
      async ({ ctx }) => {
        k += 1;
        await ctx.clock.after(10 * k);
        throw new Error("boom");
      },
      { runs: 1, seed: 1 },
    ),
  );
  expect(codeOf(drifting)).toBe("E1729");
  expect(codeOf(drifting)).not.toBe("E1704");
  const steady = await thrown(() =>
    simulate(
      async ({ ctx }) => {
        await ctx.clock.after(10);
        throw new Error("boom");
      },
      { runs: 1, seed: 1 },
    ),
  );
  expect(codeOf(steady)).toBe("E1704");
});

test("a failing run's shrunk `SimRun` is replayed twice before it is reported, whatever `law` is: a failing deterministic scenario is called at least three times and reports E1704", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 0, max: 500 }), async (wait) => {
      let calls = 0;
      const e = await thrown(() =>
        simulate(
          async ({ ctx }) => {
            calls += 1;
            await ctx.clock.after(wait);
            throw new Error("boom");
          },
          { runs: 1, seed: 1 },
        ),
      );
      expect(codeOf(e)).toBe("E1704");
      expect(calls).toBeGreaterThanOrEqual(3);
    }),
    { seed: SEED, numRuns: 10 },
  );
});

test("With `law` on, after the last run each run that passed is run a second time with its `SimRun`: a passing scenario is called exactly twice per run, and each `SimRun` it receives comes an even number of times", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 1, max: 4 }),
      fc.array(fc.integer({ min: 0, max: 300 }), { maxLength: 4 }),
      async (runs, waits) => {
        const received: string[] = [];
        await simulate(
          async ({ ctx, seed, schedule }) => {
            received.push(JSON.stringify({ seed, schedule }));
            for (const w of waits) await ctx.clock.after(w);
          },
          { runs, seed: 7, law: true },
        );
        expect(received).toHaveLength(2 * runs);
        const counts = new Map<string, number>();
        for (const r of received) counts.set(r, (counts.get(r) ?? 0) + 1);
        for (const n of counts.values()) expect(n % 2).toBe(0);
      },
    ),
    { seed: SEED, numRuns: 12 },
  );
});

test("a run that fails with E1727 is not replayed twice: a scenario whose waits drift and then stalls reports E1704 with E1727, not E1729", async () => {
  let k = 0;
  const e = await thrown(() =>
    simulate(
      async ({ ctx }) => {
        k += 1;
        await ctx.clock.after(10 * k);
        await new Promise<void>(() => {});
      },
      { runs: 1, seed: 1 },
    ),
  );
  expect(codeOf(e)).toBe("E1704");
  expect(lines(e)[0]).toContain("E1727");
});

test('Under `simulate` with `{ runs: 1, seed: 1, law: true }`, a scenario that sets storage key `n` to `String(k)`, `k` the count of its calls so far counting this one, and makes no other effect, rejects `simulate` with E1729 whose first line holds `two replays of the run differ at trace entry 0` and whose next two lines are `{"kind":"storage","key":"n","value":"1"}` and `{"kind":"storage","key":"n","value":"2"}`.', async () => {
  let k = 0;
  const e = await thrown(() =>
    simulate(
      async ({ ctx }) => {
        k += 1;
        await ctx.storage.set("n", String(k));
      },
      { runs: 1, seed: 1, law: true },
    ),
  );
  expect(codeOf(e)).toBe("E1729");
  expect(lines(e)[0]).toContain("two replays of the run differ at trace entry 0");
  expect(lines(e)[1]).toBe('{"kind":"storage","key":"n","value":"1"}');
  expect(lines(e)[2]).toBe('{"kind":"storage","key":"n","value":"2"}');
});

test("the trace ends with the final value of each storage key the run wrote, by key in code-unit order: in an empty replay with `law: true`, a drifting `a` written before a steady `B` differs at entry 1, the `storage` entries `{ kind, key, value }`", async () => {
  let k = 0;
  const e = await thrown(() =>
    simulate(
      async ({ ctx }) => {
        k += 1;
        await ctx.storage.set("a", String(k));
        await ctx.storage.set("B", "0");
      },
      { replay: { seed: 1, schedule: { net: [], storage: [], offline: [], plans: {} } }, law: true },
    ),
  );
  expect(codeOf(e)).toBe("E1729");
  expect(lines(e)[0]).toContain("two replays of the run differ at trace entry 1");
  expect(lines(e)[1]).toBe('{"kind":"storage","key":"a","value":"1"}');
  expect(lines(e)[2]).toBe('{"kind":"storage","key":"a","value":"2"}');
});

test("for any key and two different values written through something the run cannot track, the law check reports E1729 on the storage entry; with equal values it does not", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.string({ minLength: 1, maxLength: 8 }),
      fc.string({ maxLength: 6 }),
      fc.string({ maxLength: 6 }),
      async (key, v1, v2) => {
        const written = [v1, v2];
        let calls = 0;
        const scenario = async ({ ctx }: { ctx: { storage: { set(k: string, v: string): Promise<void> } } }) => {
          const v = written[calls] ?? v2;
          calls += 1;
          await ctx.storage.set(key, v);
        };
        const outcome = await thrown(() => simulate(scenario, { runs: 1, seed: 1, law: true }));
        if (v1 === v2) {
          expect(outcome).toBeUndefined();
        } else {
          expect(codeOf(outcome)).toBe("E1729");
          expect(lines(outcome)[1]).toBe(JSON.stringify({ kind: "storage", key, value: v1 }));
          expect(lines(outcome)[2]).toBe(JSON.stringify({ kind: "storage", key, value: v2 }));
        }
      },
    ),
    { seed: SEED, numRuns: 25 },
  );
});

const realMs = async (fn: () => Promise<unknown>): Promise<number> => {
  const start = process.hrtime.bigint();
  await fn();
  return Number(process.hrtime.bigint() - start) / 1e6;
};

/** Runs `fn` with `process.env.KEEL_TEST` set to `value` (unset when undefined) as `simulate` is called, then restores it. */
async function withKeelTest<T>(value: string | undefined, fn: () => Promise<T>): Promise<T> {
  const before = process.env.KEEL_TEST;
  if (value === undefined) Reflect.deleteProperty(process.env, "KEEL_TEST");
  else process.env.KEEL_TEST = value;
  try {
    return await fn();
  } finally {
    if (before === undefined) Reflect.deleteProperty(process.env, "KEEL_TEST");
    else process.env.KEEL_TEST = before;
  }
}

/** A scenario whose wait grows with its call count: two runs of one `SimRun` differ. */
const drifting = () => {
  let k = 0;
  return async ({ ctx }: { ctx: { clock: { after(ms: number): Promise<void> } } }): Promise<void> => {
    k += 1;
    await ctx.clock.after(10 * k);
  };
};

test("With `process.env.KEEL_TEST` `'1'`, `simulate` with `{ runs: 1, seed: 1 }` of a scenario that awaits `ctx.clock.after(10 * k)`, `k` the count of its calls so far counting this one, and resolves rejects with E1729 whose first line holds `two replays of the run differ at trace entry 0`; with `law: false` added, or with `KEEL_TEST` unset and no `law`, it resolves `{ seed: 1, runs: 1, checked: 0 }`.", async () => {
  const on = await withKeelTest("1", () => thrown(() => simulate(drifting(), { runs: 1, seed: 1 })));
  expect(codeOf(on)).toBe("E1729");
  expect(lines(on)[0]).toContain("two replays of the run differ at trace entry 0");
  const off = await withKeelTest("1", () => simulate(drifting(), { runs: 1, seed: 1, law: false }));
  expect(off).toEqual({ seed: 1, runs: 1, checked: 0 });
  const unset = await withKeelTest(undefined, () => simulate(drifting(), { runs: 1, seed: 1 }));
  expect(unset).toEqual({ seed: 1, runs: 1, checked: 0 });
});

test("`law` is on by default exactly when `KEEL_TEST` is `'1'`, and `law: true` or `law: false` wins either way: a deterministic scenario reports `checked` equal to `runs` or 0 accordingly", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom<string | undefined>(undefined, "1", "0", "", "true", "2"),
      fc.constantFrom<boolean | undefined>(undefined, true, false),
      fc.integer({ min: 1, max: 3 }),
      async (env, law, runs) => {
        const on = law === undefined ? env === "1" : law;
        const options = law === undefined ? { runs, seed: 1 } : { runs, seed: 1, law };
        const r = await withKeelTest(env, () =>
          simulate(async ({ ctx }) => {
            await ctx.clock.after(10);
          }, options),
        );
        expect(r).toEqual({ seed: 1, runs, checked: on ? runs : 0 });
      },
    ),
    { seed: SEED, numRuns: 24 },
  );
});

test("Under `simulate` with `{ runs: 3, seed: 1, law: true }`, a scenario that appends `JSON.stringify({ seed, schedule })` to an array and awaits `ctx.clock.after(10)`: `simulate` resolves `{ seed: 1, runs: 3, checked: 3 }`, the array holds six entries, and its last three equal its first three in order.", async () => {
  const seen: string[] = [];
  const r = await simulate(
    async ({ ctx, seed, schedule }) => {
      seen.push(JSON.stringify({ seed, schedule }));
      await ctx.clock.after(10);
    },
    { runs: 3, seed: 1, law: true },
  );
  expect(r).toEqual({ seed: 1, runs: 3, checked: 3 });
  expect(seen).toHaveLength(6);
  expect(seen.slice(3)).toEqual(seen.slice(0, 3));
});

test("with `law` on the replays come after the last run, in run order: for any run count and seed the second half of the scenario's received `SimRun`s equals the first, and `checked` is the run count", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 5 }), fc.integer({ min: 0, max: 100_000 }), async (runs, seed) => {
      const seen: string[] = [];
      const r = await simulate(
        async ({ ctx, seed: s, schedule }) => {
          seen.push(JSON.stringify({ seed: s, schedule }));
          await ctx.clock.after(10);
        },
        { runs, seed, law: true },
      );
      expect(r).toEqual({ seed, runs, checked: runs });
      expect(seen).toHaveLength(2 * runs);
      expect(seen.slice(runs)).toEqual(seen.slice(0, runs));
    }),
    { seed: SEED, numRuns: 10 },
  );
});

test("In an empty replay with `{ law: true, budget: 300 }`, a scenario that awaits a `node:timers` `setTimeout(200)` makes `simulate` resolve with `runs` 1 and `checked` 0, no sooner than 300 ms of real time after the call; with `budget: 1000`, `checked` is 1.", async () => {
  const replay = { seed: 1, schedule: { net: [], storage: [], offline: [], plans: {} } };
  const scenario = async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 200));
  };
  let stopped: Awaited<ReturnType<typeof simulate>> | undefined;
  const took = await realMs(async () => {
    stopped = await simulate(scenario, { replay, law: true, budget: 300 });
  });
  expect(stopped?.runs).toBe(1);
  expect(stopped?.checked).toBe(0);
  expect(took).toBeGreaterThanOrEqual(300);
  const roomy = await simulate(scenario, { replay, law: true, budget: 1000 });
  expect(roomy.runs).toBe(1);
  expect(roomy.checked).toBe(1);
});

test("In an empty replay with `law: true`, a scenario that counts its calls and throws rejects `simulate` with E1704 after exactly three calls; with `law: false`, the same.", async () => {
  const replay = { seed: 1, schedule: { net: [], storage: [], offline: [], plans: {} } };
  for (const law of [true, false]) {
    let calls = 0;
    const e = await thrown(() =>
      simulate(
        async () => {
          calls += 1;
          throw new Error("boom");
        },
        { replay, law },
      ),
    );
    expect(codeOf(e)).toBe("E1704");
    expect(calls).toBe(3);
  }
});

// ASSUMPTION: `ctx.storage` values are strings and the entry's `value` is the stored string as stored, so the entry lines print `"value":"1"` and `"value":"2"`; the property above builds its expected lines with `JSON.stringify` of the string.
// UNTESTABLE: the `{ kind: 'store', id, value }` entry and the `stores()` ordering; no public API of `@keel/testing` in this lane names a live store of a sim run to write a differing value into.
