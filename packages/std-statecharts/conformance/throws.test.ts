// Spec: std.statecharts, Conformance "`chart` throws E2751, E2753 and E2754 for those fixtures."
// Seed: 1337.
// Assumption: the thrown error's message or `code` carries the rule code; asserted as a match on the code text.
// E2752 and E2755 are not thrown (Checked paragraph names only E2751, E2753 and E2754), so a chart with an unreachable state does not throw.
import { s } from "@keel/schema";
import { chart } from "@keel/std-statecharts";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { nextId } from "./fixtures.ts";

const empty = s.object({});
const data = s.object({ n: s.int({ min: 0, max: 3 }) });
const base = { data, start: { n: 0 }, events: { go: empty, stop: empty } } as const;
describe("std.statecharts: chart repeats E2751, E2753 and E2754 as throws", () => {
  test.skip("`chart` throws E2751, E2753 and E2754 for those fixtures", () => {
    // clean twin
    expect(() =>
      chart(nextId("ok"), { ...base, initial: "a", states: { a: { on: { go: "b" } }, b: { final: true } } }),
    ).not.toThrow();

    // E2751: `initial` naming no state, `to` naming no state
    expect(() =>
      chart(nextId("e1"), { ...base, initial: "z", states: { a: { on: { go: "b" } }, b: { final: true } } }),
    ).toThrow(/E2751/);
    expect(() =>
      chart(nextId("e1"), { ...base, initial: "a", states: { a: { on: { go: "zz" } }, b: { final: true } } }),
    ).toThrow(/E2751/);
    expect(() =>
      chart(nextId("e1"), {
        ...base,
        initial: "a",
        states: { a: { on: { go: [{ to: "b", guard: "g" }, { to: "zz" }] } }, b: { final: true } },
        guards: { g: () => true },
      }),
    ).toThrow(/E2751/);

    // E2753: a non-final state with no target to another state
    expect(() => chart(nextId("e3"), { ...base, initial: "a", states: { a: { on: { go: "b" } }, b: {} } })).toThrow(
      /E2753/,
    );
    expect(() =>
      chart(nextId("e3"), { ...base, initial: "a", states: { a: { on: { go: "b" } }, b: { on: { stop: "b" } } } }),
    ).toThrow(/E2753/);

    // E2754: a final state with `on`, an `on` event missing from `events`, a `guard` or `do` naming no entry
    expect(() =>
      chart(nextId("e4"), {
        ...base,
        initial: "a",
        states: { a: { on: { go: "b" } }, b: { final: true, on: { go: "a" } } },
      }),
    ).toThrow(/E2754/);
    expect(() =>
      chart(nextId("e4"), {
        ...base,
        initial: "a",
        states: { a: { on: { go: "b", ghost: "b" } }, b: { final: true } },
      }),
    ).toThrow(/E2754/);
    expect(() =>
      chart(nextId("e4"), {
        ...base,
        initial: "a",
        states: { a: { on: { go: { to: "b", guard: "nope" } } }, b: { final: true } },
      }),
    ).toThrow(/E2754/);
    expect(() =>
      chart(nextId("e4"), {
        ...base,
        initial: "a",
        states: { a: { on: { go: { to: "b", do: "nope" } } }, b: { final: true } },
      }),
    ).toThrow(/E2754/);

    // E2752 is the checker's alone: an unreachable state does not throw
    expect(() =>
      chart(nextId("e2"), {
        ...base,
        initial: "a",
        states: { a: { on: { go: "b" } }, b: { final: true }, c: { on: { go: "a" } } },
      }),
    ).not.toThrow();
  });

  test.skip("`chart` throws E2751 for any generated `initial` that is not a declared state", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z]{1,6}$/).filter((n) => n !== "a" && n !== "b"),
        (initial) => {
          expect(() =>
            chart(nextId("gen"), { ...base, initial, states: { a: { on: { go: "b" } }, b: { final: true } } }),
          ).toThrow(/E2751/);
        },
      ),
      { seed: 1337, numRuns: 50 },
    );
  });
});
