// `taken` names the target an event's transaction takes: the first of `on[event]` whose guard holds, a bare state name
// read as `{ to }`, `undefined` when none holds or the state's `on` lacks the event; `next` moves to its `to`. Seed 1337.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { chart } from "@keel/std-statecharts";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const c = scope(() => undefined, { detached: true }).run(() =>
  chart("todos.takenPick", {
    data: s.object({ n: s.int({ min: 0, max: 3 }) }),
    start: { n: 0 },
    events: { go: s.object({ by: s.int({ min: 0, max: 3 }) }), back: s.object({}), stop: s.object({}) },
    guards: { far: (_d, p) => "by" in p && p.by >= 2, low: (d) => d.n < 2 },
    actions: { inc: (d) => ({ n: Math.min(3, d.n + 1) }) },
    initial: "a",
    states: {
      a: {
        on: {
          go: [
            { to: "b", guard: "far", do: "inc" },
            { guard: "low", do: "inc" },
            { to: "a", guard: "low" },
          ],
          stop: "c",
        },
      },
      b: { on: { back: "a", go: { guard: "low" } } },
      c: { final: true },
    },
  }),
);

type Ev = "go" | "back" | "stop";
const payloadOf = (event: Ev, by: number) => (event === "go" ? { by } : {});

describe("std.statecharts taken", () => {
  test("is the first target whose guard holds, a bare name read as { to }, else undefined", () => {
    expect(c.taken({ state: "a", data: { n: 0 } }, "go", { by: 3 })).toEqual({ to: "b", guard: "far", do: "inc" });
    expect(c.taken({ state: "a", data: { n: 0 } }, "go", { by: 0 })).toEqual({ guard: "low", do: "inc" });
    expect(c.taken({ state: "a", data: { n: 3 } }, "go", { by: 0 })).toBeUndefined();
    expect(c.taken({ state: "a", data: { n: 0 } }, "stop", {})).toEqual({ to: "c" });
    expect(c.taken({ state: "a", data: { n: 0 } }, "back", {})).toBeUndefined();
    expect(c.taken({ state: "c", data: { n: 0 } }, "stop", {})).toBeUndefined();
    expect(c.taken({ state: "elsewhere", data: { n: 0 } }, "stop", {})).toBeUndefined();
  });

  test("agrees with next and enabled for generated states, data and payloads", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<"a" | "b" | "c">("a", "b", "c"),
        fc.integer({ min: 0, max: 3 }),
        fc.constantFrom<Ev>("go", "back", "stop"),
        fc.integer({ min: 0, max: 3 }),
        (state, n, event, by) => {
          const from = { state, data: { n } };
          const p = payloadOf(event, by);
          const t = c.taken(from, event, p);
          const to = c.next(from, event, p);
          expect(to.state).toBe(t?.to ?? state);
          if (t?.do === undefined) expect(to.data).toEqual(from.data);
          expect(c.enabled(from, event, p)).toBe(t !== undefined && (t.do !== undefined || (t.to ?? state) !== state));
        },
      ),
      { seed: 1337, numRuns: 300 },
    );
  });
});
