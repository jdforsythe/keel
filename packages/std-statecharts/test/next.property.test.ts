// `next` reads no store: for generated `{ state, data }` and events it returns the same value twice and leaves the
// chart's store as it was. Seed 1337.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { chart } from "@keel/std-statecharts";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const c = scope(() => undefined, { detached: true }).run(() =>
  chart("todos.nextPure", {
    data: s.object({ n: s.int({ min: 0, max: 3 }) }),
    start: { n: 0 },
    events: { go: s.object({}), stop: s.object({}) },
    guards: { small: (d) => d.n < 3 },
    actions: { inc: (d) => ({ n: Math.min(3, d.n + 1) }) },
    initial: "a",
    states: {
      a: { on: { go: { to: "b", guard: "small", do: "inc" }, stop: "c" } },
      b: { on: { go: { do: "inc" }, stop: "a" } },
      c: { final: true },
    },
  }),
);

describe("std.statecharts next", () => {
  test("is pure and leaves the store unchanged", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("a", "b", "c"),
        fc.integer({ min: 0, max: 3 }),
        fc.constantFrom<"go" | "stop">("go", "stop"),
        (state, n, event) => {
          const before = c.store.snapshot().state;
          const from = { state, data: { n } };
          expect(c.next(from, event, {})).toEqual(c.next(from, event, {}));
          expect(c.store.snapshot().state).toEqual(before);
        },
      ),
      { seed: 1337, numRuns: 200 },
    );
  });
});
