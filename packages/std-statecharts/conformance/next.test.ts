// Spec: std.statecharts, Conformance "For generated `{ state, data }` and payloads, `next` equals the state `tx` of that event gives from it."
// Seed: 1337.
// Assumption: `next({ state, data }, event, payload)` is called with the event's name; a state is put in a chart's store with `setState` from fixtures.ts, and `tx` of an event with no applicable target leaves it unchanged.
import { s } from "@keel/schema";
import { chart } from "@keel/std-statecharts";
import { tx } from "@keel/store";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { EVENTS, STATES, editor, nextId, setState } from "./fixtures.ts";

const sorter = () =>
  chart(nextId("sorter"), {
    data: s.object({ n: s.int({ min: 0, max: 3 }) }),
    start: { n: 0 },
    events: { sort: s.object({ by: s.int({ min: 0, max: 3 }) }), never: s.object({}) },
    guards: { big: (_d, p) => p.by >= 2, nope: () => false },
    actions: { take: (d, p) => ({ n: Math.min(3, d.n + p.by) }), zero: () => ({ n: 0 }) },
    initial: "inbox",
    states: {
      inbox: {
        on: {
          sort: [
            { to: "big", guard: "big", do: "take" },
            { to: "small", do: "take" },
          ],
          never: { to: "small", guard: "nope", do: "zero" },
        },
      },
      big: { final: true },
      small: { final: true },
    },
  });

describe("std.statecharts: `next` is the state `tx` gives", () => {
  test("For generated `{ state, data }` and payloads, `next` equals the state `tx` of that event gives from it.", async () => {
    const c = editor("next");
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...STATES),
        fc.integer({ min: 0, max: 3 }),
        fc.constantFrom(...EVENTS),
        async (state, attempts, event) => {
          const from = { state, data: { attempts } };
          const want = c.next(from, event, {});
          setState(c.store, from);
          await tx(c.events[event], {});
          expect(c.store.snapshot().state).toEqual(want);
        },
      ),
      { seed: 1337, numRuns: 200 },
    );
  });

  test("`next` equals the state `tx` gives for a chart with payloads and guards on them", async () => {
    const c = sorter();
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("inbox", "big", "small"),
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 0, max: 3 }),
        fc.boolean(),
        async (state, n, by, never) => {
          const from = { state, data: { n } };
          setState(c.store, from);
          if (never) {
            const want = c.next(from, "never", {});
            await tx(c.events.never, {});
            expect(c.store.snapshot().state).toEqual(want);
          } else {
            const want = c.next(from, "sort", { by });
            await tx(c.events.sort, { by });
            expect(c.store.snapshot().state).toEqual(want);
          }
        },
      ),
      { seed: 1337, numRuns: 200 },
    );
  });
});
