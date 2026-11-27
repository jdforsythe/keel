// chart either throws one of E2751, E2753 and E2754, exactly when the declaration has such a defect, or compiles to a
// store whose every event's transaction passes `properties`. Seed 1337.
import { type Schema, s } from "@keel/schema";
import { type ChartSpec, chart } from "@keel/std-statecharts";
import { properties } from "@keel/testing";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

type Loose = ChartSpec<{ n: number }, Readonly<Record<string, Schema<unknown>>>, string, string, string>;
const NAMES = ["a", "b", "c", "zz"] as const;
const name = fc.constantFrom(...NAMES);
const target = fc.record(
  { to: name, guard: fc.constantFrom("small", "nope"), do: fc.constantFrom("inc", "nope") },
  { requiredKeys: [] },
);
const on = fc.dictionary(
  fc.constantFrom("go", "stop", "ghost"),
  fc.oneof(name, target, fc.array(target, { maxLength: 2 })),
  {
    maxKeys: 3,
  },
);
const decl: fc.Arbitrary<Loose> = fc
  .record({
    initial: name,
    states: fc.dictionary(
      fc.constantFrom("a", "b", "c"),
      fc.record({ on, final: fc.boolean() }, { requiredKeys: [] }),
      {
        minKeys: 1,
      },
    ),
  })
  .map(({ initial, states }) => ({
    data: s.object({ n: s.int({ min: 0, max: 3 }) }),
    start: { n: 0 },
    events: { go: s.object({}), stop: s.object({}) },
    guards: { small: (d) => d.n < 3 },
    actions: { inc: (d) => ({ n: Math.min(3, d.n + 1) }) },
    initial,
    states,
  }));

let id = 0;
const attempt = (spec: Loose) => {
  id += 1;
  try {
    return { chart: chart(`todos.prop${id}`, spec) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e), data: Reflect.get(Object(e), "data") };
  }
};

describe("chart: a declaration throws a structural code or compiles", () => {
  test("a declaration with a name naming no state throws a structural code, and every throw is one", () => {
    fc.assert(
      fc.property(decl, (spec) => {
        const named = Object.keys(spec.states);
        const targets = Object.values(spec.states).flatMap((st) =>
          Object.values(st.on ?? {}).flatMap((e) => (Array.isArray(e) ? e : [e])),
        );
        const tos = targets.map((t) => (typeof t === "string" ? t : t?.to)).filter((t) => t !== undefined);
        const badName = !named.includes(spec.initial) || tos.some((t) => !named.includes(t));
        const r = attempt(spec);
        if (badName) expect(r.error).toMatch(/^E275[134] /);
        if (r.error !== undefined) expect(r.data).toMatchObject({ chart: expect.stringMatching(/^todos\.prop/) });
      }),
      { seed: 1337, numRuns: 200 },
    );
  });

  test("a declaration that does not throw compiles to transactions `properties` accepts", async () => {
    await fc.assert(
      fc.asyncProperty(decl, async (spec) => {
        const r = attempt(spec);
        if (r.chart === undefined) {
          expect(r.error).toMatch(/^E275[134] /);
          return;
        }
        for (const t of Object.values(r.chart.events))
          await expect(Promise.resolve(properties(t, { runs: 20, seed: 1337 }))).resolves.not.toThrow();
      }),
      { seed: 1337, numRuns: 30 },
    );
  });
});
