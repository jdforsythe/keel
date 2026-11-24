// @vitest-environment happy-dom
// Spec: k.drive, Conformance "Under `simulate` with `{ runs: 1, seed: 1, law: true }`, a scenario that awaits `ctx.clock.after(10 * k)`, `k` the count of its calls so far counting this one, rejects `simulate` with E1729 whose first line holds `two replays of the run differ at trace entry 0`."
// Spec: k.drive, Conformance "Under `simulate` with `{ runs: 1, seed: 1 }`, a scenario that awaits `ctx.clock.after(10 * k)`, `k` as above, then throws rejects `simulate` with E1729, not E1704; one that awaits `ctx.clock.after(10)` then throws rejects with E1704."
// Spec: k.drive, Law check "With `law: true` each run is run a second time with its `SimRun` and the two traces are compared; a failing run's shrunk `SimRun`, unless it failed with E1727 or E1728, is always replayed twice before it is reported."
// Spec: k.drive, Law check "Two traces that differ, final values included, fail with E1729 (k.testing) `two replays of the run differ at trace entry <n>`, the two entries as JSON on the next two lines, in place of E1704."
// Spec: k.drive, Law "The run's trace ends with the final value of each storage key the run wrote, by key in code-unit order, then the snapshot of each live store (`stores()`), by id. Entries are `{ kind: 'moment', at }`, `{ kind: 'event', at, event }`, `{ kind: 'storage', key, value }` and `{ kind: 'store', id, value }`."
// Spec: k.drive, Law "Three things escape the tracker and can change a trace: a resource made before the run or outside its context (a worker started at import, a module-level timer, channel or `AsyncResource`), unless the work answering through it is held; an `import()` in app code other than a harness's `routes` loader, which the test runner answers over its own channel; state kept outside the run's stores from one run to the next."
// Spec: k.drive, Law "The law check reports a difference only when `law` is on or on the replays of a failing run, and only when it reaches the trace."
// Spec: k.drive, Conformance "Under `simulate` with `{ runs: 1, seed: 1, law: true }`, a scenario that sets storage key `n` to `k`, `k` the count of its calls so far counting this one, and makes no other effect, rejects `simulate` with E1729 whose first line holds `two replays of the run differ at trace entry 0` and whose next two lines are `{"kind":"storage","key":"n","value":1}` and `{"kind":"storage","key":"n","value":2}`."
// Spec: k.testing, Rules "E1727 a `simulate` scenario waiting on nothing the run can move, E1728 held work waiting on the clock or work in flight that never answers (k.drive Stalls), E1729 two replays of a run whose traces differ (k.drive Law check)"
// Seed: 1337 (fc.assert below); the runs below use `simulate` seeds 1 and 7.
// ASSUMPTION: "made nondeterministic on purpose through something the run cannot track" is state kept outside the run's stores from one run to the next (the clause's `k`, a module-level counter); the other named residual, a reply through a channel made before the run that no capability holds, races real time against the drive and has no stable trace difference to assert, so it is not tested.
// ASSUMPTION: "trace entry 0" is the first moment taken; the two entries on the next two lines are JSON that parse and differ, their keys not named by the spec.
// ASSUMPTION: "replayed twice" is counted in scenario calls: a failing run shrinks (any number of calls), then its shrunk SimRun is replayed twice, so a failing run calls the scenario at least three times; `law: true` calls it exactly twice per run.
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

test("a failing run's shrunk `SimRun` is always replayed twice before it is reported: a failing deterministic scenario is called at least three times and reports E1704", async () => {
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

test("With `law: true` each run is run a second time with its `SimRun`: a passing scenario is called exactly twice per run, and each `SimRun` it receives comes an even number of times", async () => {
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

test('Under `simulate` with `{ runs: 1, seed: 1, law: true }`, a scenario that sets storage key `n` to `k`, `k` the count of its calls so far counting this one, and makes no other effect, rejects `simulate` with E1729 whose first line holds `two replays of the run differ at trace entry 0` and whose next two lines are `{"kind":"storage","key":"n","value":1}` and `{"kind":"storage","key":"n","value":2}`.', async () => {
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
  expect(lines(e)[1]).toBe('{"kind":"storage","key":"n","value":1}');
  expect(lines(e)[2]).toBe('{"kind":"storage","key":"n","value":2}');
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
  expect(lines(e)[1]).toBe('{"kind":"storage","key":"a","value":1}');
  expect(lines(e)[2]).toBe('{"kind":"storage","key":"a","value":2}');
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

// ASSUMPTION: `ctx.storage` values are strings, so `k` is written as `String(k)` and the spec's literal entry lines (`"value":1`) are asserted as printed; the trace entry's value may be printed as a number or a string, which the clause leaves open (reported).
// UNTESTABLE: the `{ kind: 'store', id, value }` entry and the `stores()` ordering; no public API of `@keel/testing` in this lane names a live store of a sim run to write a differing value into.
