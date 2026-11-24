// @vitest-environment happy-dom
// Spec: k.sim, Conformance "Under `simulate` with `replay` of a `SimRun` of seed 1 and an empty schedule, a scenario that awaits a promise nothing resolves, with no clock waiter, rejects `simulate` with E1704 whose first line holds `E1727 the scenario waits and nothing in the run is due`."
// Spec: k.sim, Conformance "Under `simulate` with `replay` of a `SimRun` of seed 1 and an empty schedule and `horizon: 1000`, a scenario that awaits `ctx.clock.after(5000)` rejects `simulate` with E1704 whose first line holds `E1727 the scenario waits past the horizon: next deadline 5000 ms`, the clock at 0."
// Spec: k.sim, Conformance "A capability registered with a `sim` factory whose `work()` returns `hold(new Promise(() => {}), 'probe')`: under `simulate` with `replay` of a `SimRun` of seed 1 and an empty schedule, a scenario that awaits `work()` rejects `simulate` with E1704 whose first line holds `E1728 work in flight never answered: probe`."
// Spec: k.sim, Stalls "A scenario pending with no `run` call of it pending, in a run idle with no `ctx.net` route unanswered and no moment within its bound through 1,000 more macrotask turns, fails the run with E1727 (k.testing), `the scenario waits past the horizon: next deadline <n> ms` when `ctx.clock.next()` is `n`, else `the scenario waits and nothing in the run is due`. Held work pending, or an unanswered `ctx.net` route with no moment within the bound, through 200,000 macrotask turns with no store log or DOM change fails it with E1728 `work in flight never answered: <label>`, `<label>` the held work's, else `a ctx.net request`. The bounds count turns, not time."
// Spec: k.testing, Rules "E1727 a `simulate` scenario waiting on nothing the run can move, E1728 work in flight that never answers (k.sim Stalls)"
// Spec: k.sim, Failure "A failing run is shrunk (fewer steps, shorter delays, fewer faults and windows) and reported as E1704 (k.testing) with the seed, the run, and the shrunk `SimRun` as JSON on the next line."
// Seed: 1337 (fc.assert below); replays use a SimRun of seed 1 and an empty schedule. No timer; the held promise never settles.
// ASSUMPTION: "first line" is the message's first line; the E1704 line holds the stall text after the code. E1727 and E1728 are runtime codes (no `keel check` fixture), reached by the operator only as E1704.
// ASSUMPTION: E1728's `a ctx.net request` case: a route that awaits a promise nothing resolves, fetched by the scenario.
import { register } from "@keel/ctx";
import type { SimCtx } from "@keel/ctx";
import { simulate } from "@keel/testing";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, codeOf, messageOf, thrown } from "./fixtures.ts";

const replay = { seed: 1, schedule: { net: [], storage: [], offline: [], plans: {} } };
const firstLine = (e: unknown): string => messageOf(e).split("\n")[0] ?? "";

type Probe = { work(): Promise<void> };
const hung = register("simStallsProbe", {
  real: (): Probe => ({ work: () => Promise.resolve() }),
  shell: (): Probe => ({ work: () => Promise.resolve() }),
  sim: ({ hold }): Probe => ({ work: () => hold(new Promise<void>(() => {}), "probe") }),
});

test("Under `simulate` with `replay` of a `SimRun` of seed 1 and an empty schedule, a scenario that awaits a promise nothing resolves, with no clock waiter, rejects `simulate` with E1704 whose first line holds `E1727 the scenario waits and nothing in the run is due`.", async () => {
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

test("Under `simulate` with `replay` of a `SimRun` of seed 1 and an empty schedule and `horizon: 1000`, a scenario that awaits `ctx.clock.after(5000)` rejects `simulate` with E1704 whose first line holds `E1727 the scenario waits past the horizon: next deadline 5000 ms`, the clock at 0.", async () => {
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
  "A capability registered with a `sim` factory whose `work()` returns `hold(new Promise(() => {}), 'probe')`: under `simulate` with `replay` of a `SimRun` of seed 1 and an empty schedule, a scenario that awaits `work()` rejects `simulate` with E1704 whose first line holds `E1728 work in flight never answered: probe`.",
  { timeout: 120_000 },
  async () => {
    const e = await thrown(() =>
      simulate(
        async ({ ctx }) => {
          await hung(ctx).work();
        },
        { replay },
      ),
    );
    expect(codeOf(e)).toBe("E1704");
    expect(firstLine(e)).toContain("E1728 work in flight never answered: probe");
  },
);

test(
  "E1728 work in flight that never answers: an unanswered `ctx.net` route with no moment within the bound is named `a ctx.net request`",
  { timeout: 120_000 },
  async () => {
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
    expect(firstLine(e)).toContain("E1728 work in flight never answered: a ctx.net request");
  },
);

test(
  "E1728 reaches the operator as E1704 with the shrunk `SimRun` as JSON on the next line",
  { timeout: 120_000 },
  async () => {
    const e = await thrown(() =>
      simulate(
        async ({ ctx }) => {
          await hung(ctx).work();
        },
        { runs: 3, seed: SEED },
      ),
    );
    expect(codeOf(e)).toBe("E1704");
    const lines = messageOf(e).split("\n");
    expect(lines[0]).toContain("E1728");
    expect(JSON.parse(lines[1] ?? "")).toMatchObject({ schedule: expect.any(Object) });
  },
);
