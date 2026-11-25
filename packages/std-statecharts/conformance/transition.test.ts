// Spec: std.statecharts, clause "`tx` of an event moves to the first target whose guard holds and applies its `do`; with no applicable target the state and `data` are unchanged."
// Seed: 1337.
// Assumption: `tx` of an event with no applicable target may return ok or err; only the store's state is asserted.
import { s } from "@keel/schema";
import { chart } from "@keel/std-statecharts";
import { tx } from "@keel/store";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { EVENTS, editor, nextId } from "./fixtures.ts";

const Bump = s.object({ by: s.int({ min: 0, max: 3 }) });
const sorter = () =>
  chart(nextId("sorter"), {
    data: s.object({ n: s.int({ min: 0, max: 3 }) }),
    start: { n: 0 },
    events: { sort: Bump, never: s.object({}) },
    guards: { big: (_d, p) => p.by >= 2, nope: () => false },
    actions: { take: (d, p) => ({ n: d.n + p.by }), zero: () => ({ n: 0 }) },
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

describe("std.statecharts: a transaction takes the first applicable target", () => {
  test("`tx` of an event moves to the first target whose guard holds and applies its `do`", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 3 }), async (by) => {
        const c = sorter();
        await tx(c.events.sort, { by });
        expect(c.store.snapshot().state).toEqual({ state: by >= 2 ? "big" : "small", data: { n: by } });
      }),
      { seed: 1337, numRuns: 40 },
    );
    const e = editor("walk");
    await tx(e.events.edit, {});
    await tx(e.events.save, {});
    expect(e.store.snapshot().state).toEqual({ state: "saving", data: { attempts: 1 } });
    await tx(e.events.failed, {});
    await tx(e.events.failed, {});
    expect(e.store.snapshot().state).toEqual({ state: "saving", data: { attempts: 3 } });
    await tx(e.events.failed, {});
    expect(e.store.snapshot().state).toEqual({ state: "gaveUp", data: { attempts: 3 } });
  });

  test("with no applicable target the state and `data` are unchanged", async () => {
    const c = sorter();
    await tx(c.events.never, {});
    expect(c.store.snapshot().state).toEqual({ state: "inbox", data: { n: 0 } });

    // gaveUp is final: no event leaves it, whatever the payload-free event.
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...EVENTS), async (ev) => {
        const g = editor("gaveup");
        await tx(g.events.edit, {});
        await tx(g.events.save, {});
        await tx(g.events.failed, {});
        await tx(g.events.failed, {});
        await tx(g.events.failed, {});
        const before = g.store.snapshot().state;
        expect(before).toEqual({ state: "gaveUp", data: { attempts: 3 } });
        await tx(g.events[ev], {});
        expect(g.store.snapshot().state).toEqual(before);
      }),
      { seed: 1337, numRuns: 20 },
    );
    const e = editor("final");
    await tx(e.events.edit, {});
    await tx(e.events.edit, {});
    expect(e.store.snapshot().state).toEqual({ state: "editing", data: { attempts: 0 } });
  });
});
