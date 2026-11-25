// Spec: std.headless, clause "`optionsChart`, `openChart` and `toastChart` hold the transitions in the table; under `explore`'s closed form `openChart` and `toastChart` are `complete` and `coverage` is empty; `explore` of `optionsChart` from `initial` with counts 0, 1 and 3, `at` and `to` -1, 0, 2 and 5, every `by`, `wrap` and `back`, at depth 6, finds no state breaking its invariant."
// Seed: 1337.
// Assumptions: `coverage` comes from `@keel/std-statecharts`; "empty" is `unreached` and `dead` both `[]`; `from: optionsChart.initial` is the start;
// the `payloads` key of an event is its transaction name `<id>.<event>`; the invariant (`active` is -1 or below `count`, and -1 in `closed`) is read from the explored states.
import { openChart, optionsChart, toastChart } from "@keel/std-headless";
import { coverage } from "@keel/std-statecharts";
import { explore } from "@keel/testing";
import { describe, expect, test } from "vitest";
import { optionsView } from "./fixtures.ts";

describe("std.headless: exploring the charts", () => {
  test("under `explore`'s closed form `openChart` is `complete` and `coverage` is empty", () => {
    const r = explore(Object.values(openChart.events));
    expect(r.complete).toBe(true);
    const c = coverage(openChart, r);
    expect(c.unreached).toEqual([]);
    expect(c.dead).toEqual([]);
    expect(new Set(r.states.map((st) => st.state))).toEqual(new Set(["closed", "open"]));
  });

  test("under `explore`'s closed form `toastChart` is `complete` and `coverage` is empty", () => {
    const r = explore(Object.values(toastChart.events));
    expect(r.complete).toBe(true);
    const c = coverage(toastChart, r);
    expect(c.unreached).toEqual([]);
    expect(c.dead).toEqual([]);
    expect(new Set(r.states.map((st) => st.state))).toEqual(new Set(["showing", "paused", "gone"]));
  });

  test("`explore` of `optionsChart` from `initial` with counts 0, 1 and 3, `at` and `to` -1, 0, 2 and 5, every `by`, `wrap` and `back`, at depth 6, finds no state breaking its invariant", () => {
    const e = optionsChart.events;
    const counts = [0, 1, 3];
    const marks = [-1, 0, 2, 5];
    const r = explore(Object.values(e), {
      from: { state: optionsChart.initial, data: { active: -1, count: 0, back: false } },
      depth: 6,
      payloads: {
        [e.open.name]: counts.flatMap((count) => marks.map((at) => ({ count, at }))),
        [e.close.name]: [{ back: false }, { back: true }],
        [e.choose.name]: [{}],
        [e.move.name]: (["next", "prev", "first", "last"] as const).flatMap((by) =>
          [false, true].map((wrap) => ({ by, wrap })),
        ),
        [e.jump.name]: marks.map((to) => ({ to })),
        [e.items.name]: counts.map((count) => ({ count })),
      },
    });
    expect(r.states.length).toBeGreaterThan(1);
    for (const st of r.states) {
      const v = optionsView(st);
      expect(v).toBeDefined();
      if (v === undefined) continue;
      expect(v.active === -1 || v.active < v.count).toBe(true);
      if (v.state === "closed") expect(v.active).toBe(-1);
    }
  });
});
