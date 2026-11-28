// Spec: std.statecharts, clause "`chart` throws E2751, E2753 and E2754 for those fixtures."
// Seed: 1337.
// Assumption: the thrown error's message or `code` carries the rule code; asserted as a match on the code text.
// E2752 and E2755 are not thrown (Checked paragraph names only E2751, E2753 and E2754), so a chart with an unreachable state does not throw.
import { type Schema, s } from "@keel/schema";
import { type ChartSpec, chart } from "@keel/std-statecharts";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { nextId, inRoot } from "./fixtures.ts";

const empty = s.object({});
const data = s.object({ n: s.int({ min: 0, max: 3 }) });
const base = { data, start: { n: 0 }, events: { go: empty, stop: empty } } as const;
/** A declaration with every state, event, guard and action name typed `string`, so names `chart`'s types refuse reach its throws. */
const loose = (spec: ChartSpec<{ n: number }, Readonly<Record<string, Schema<unknown>>>, string, string, string>) =>
  spec;
describe("std.statecharts: chart repeats E2751, E2753 and E2754 as throws", () => {
  test("`chart` throws E2751, E2753 and E2754 for those fixtures", () => {
    // clean twin
    expect(() =>
      inRoot(() =>
        chart(nextId("ok"), { ...base, initial: "a", states: { a: { on: { go: "b" } }, b: { final: true } } }),
      ),
    ).not.toThrow();

    // E2751: `initial` naming no state, `to` naming no state
    expect(() =>
      inRoot(() =>
        chart(nextId("e1"), loose({ ...base, initial: "z", states: { a: { on: { go: "b" } }, b: { final: true } } })),
      ),
    ).toThrow(/E2751/);
    expect(() =>
      inRoot(() =>
        chart(nextId("e1"), loose({ ...base, initial: "a", states: { a: { on: { go: "zz" } }, b: { final: true } } })),
      ),
    ).toThrow(/E2751/);
    expect(() =>
      inRoot(() =>
        chart(
          nextId("e1"),
          loose({
            ...base,
            initial: "a",
            states: { a: { on: { go: [{ to: "b", guard: "g" }, { to: "zz" }] } }, b: { final: true } },
            guards: { g: () => true },
          }),
        ),
      ),
    ).toThrow(/E2751/);

    // E2753: a non-final state with no target to another state
    expect(() =>
      inRoot(() => chart(nextId("e3"), { ...base, initial: "a", states: { a: { on: { go: "b" } }, b: {} } })),
    ).toThrow(/E2753/);
    expect(() =>
      inRoot(() =>
        chart(nextId("e3"), { ...base, initial: "a", states: { a: { on: { go: "b" } }, b: { on: { stop: "b" } } } }),
      ),
    ).toThrow(/E2753/);

    // E2754: a final state with `on`, an `on` event missing from `events`, a `guard` or `do` naming no entry
    expect(() =>
      inRoot(() =>
        chart(nextId("e4"), {
          ...base,
          initial: "a",
          states: { a: { on: { go: "b" } }, b: { final: true, on: { go: "a" } } },
        }),
      ),
    ).toThrow(/E2754/);
    expect(() =>
      inRoot(() =>
        chart(
          nextId("e4"),
          loose({
            ...base,
            initial: "a",
            states: { a: { on: { go: "b", ghost: "b" } }, b: { final: true } },
          }),
        ),
      ),
    ).toThrow(/E2754/);
    expect(() =>
      inRoot(() =>
        chart(
          nextId("e4"),
          loose({
            ...base,
            initial: "a",
            states: { a: { on: { go: { to: "b", guard: "nope" } } }, b: { final: true } },
          }),
        ),
      ),
    ).toThrow(/E2754/);
    expect(() =>
      inRoot(() =>
        chart(
          nextId("e4"),
          loose({
            ...base,
            initial: "a",
            states: { a: { on: { go: { to: "b", do: "nope" } } }, b: { final: true } },
          }),
        ),
      ),
    ).toThrow(/E2754/);

    // E2752 is the checker's alone: an unreachable state does not throw
    expect(() =>
      inRoot(() =>
        chart(nextId("e2"), {
          ...base,
          initial: "a",
          states: { a: { on: { go: "b" } }, b: { final: true }, c: { on: { go: "a" } } },
        }),
      ),
    ).not.toThrow();
  });

  test("`chart` throws E2751 for any generated `initial` that is not a declared state", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z]{1,6}$/).filter((n) => n !== "a" && n !== "b"),
        (initial) => {
          expect(() =>
            inRoot(() =>
              chart(nextId("gen"), loose({ ...base, initial, states: { a: { on: { go: "b" } }, b: { final: true } } })),
            ),
          ).toThrow(/E2751/);
        },
      ),
      { seed: 1337, numRuns: 50 },
    );
  });
});
