// Spec: std.statecharts, clause "`enabled(state, event, payload)` is true exactly when `tx` of that event changes the state's name or applies a `do`."
// Seed: 1337.
// Assumption: `state` is the store's state value `{ state, data }` (the guards need `data`).
// Not tested: an applicable target with `to` absent and no `do`; the Compiles-to paragraph ("true when a target applies") and this sentence disagree on it.
import { s } from "@keel/schema";
import { chart } from "@keel/std-statecharts";
import { tx } from "@keel/store";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { EVENTS, STATES, editor, nextId, setState, inRoot } from "./fixtures.ts";

const Add = s.object({ by: s.int({ min: 0, max: 3 }) });
const gate = () =>
  inRoot(() =>
    chart(nextId("gate"), {
      data: s.object({ n: s.int({ min: 0, max: 3 }) }),
      start: { n: 0 },
      events: { add: Add, tick: s.object({}), close: s.object({}) },
      guards: { fits: (d, p) => d.n + p.by <= 3 },
      actions: { sum: (d, p) => ({ n: d.n + p.by }), bump: (d) => ({ n: Math.min(3, d.n + 1) }) },
      initial: "open",
      states: {
        open: { on: { add: { guard: "fits", do: "sum" }, tick: { do: "bump" }, close: "shut" } },
        shut: { final: true },
      },
    }),
  );

describe("std.statecharts: enabled agrees with tx", () => {
  test("`enabled(state, event, payload)` is true exactly when `tx` of that event changes the state's name or applies a `do`", async () => {
    // the editor: every applicable target changes the name or the data
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...STATES),
        fc.integer({ min: 0, max: 2 }),
        fc.constantFrom(...EVENTS),
        async (name, attempts, ev) => {
          const c = editor("enabled");
          const state = { state: name, data: { attempts } };
          setState(c.store, state);
          const flag = c.enabled(state, ev, {});
          await tx(c.events[ev], {});
          const after = c.store.snapshot().state;
          expect(flag).toBe(after.state !== name || after.data.attempts !== attempts);
        },
      ),
      { seed: 1337, numRuns: 150 },
    );
    // a payload-dependent guard and a `do` that need not change `data` (by 0), and a stay-with-`do` target
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 3 }), async (n, by) => {
        const c = gate();
        const state = { state: "open" as const, data: { n } };
        setState(c.store, state);
        expect(c.enabled(state, "add", { by })).toBe(n + by <= 3);
        expect(c.enabled(state, "tick", {})).toBe(true);
        expect(c.enabled(state, "close", {})).toBe(true);
        await tx(c.events.add, { by });
        const after = c.store.snapshot().state;
        if (n + by <= 3) expect(after).toEqual({ state: "open", data: { n: n + by } });
        else expect(after).toEqual(state);
        expect(c.enabled({ state: "shut", data: { n } }, "add", { by })).toBe(false);
      }),
      { seed: 1337, numRuns: 80 },
    );
  });
});
