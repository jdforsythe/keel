import { createCtx } from "@keel/ctx";
import { coverage } from "@keel/std-statecharts";
import { explore, properties } from "@keel/testing";
import { expect, it } from "vitest";
import { putBackIn } from "../modules/shopping/putBackIn.ts";
import { restockChart } from "../modules/shopping/restockChart.ts";
import { runsOf } from "../modules/shopping/runsOf.ts";
import { weeklyStaples } from "../modules/shopping/weeklyStaples.ts";

const data = { staples: weeklyStaples, next: 0, putBack: 0, by: "member" as const, at: 0, code: "" };
const events = Object.values(restockChart.events);
const ids = createCtx({ mode: "sim", seed: 3 });
const id = () => ids.random.id("Item");

it("reaches done or failed from every state of a five-staple run, and counts what it put back", () => {
  const r = explore(events, {
    from: { state: "putting", data },
    payloads: {
      "shopping.restockChart.put": [{ putBack: true }, { putBack: false }],
      "shopping.restockChart.failed": [{ code: "workflows.attempts" }],
      "shopping.restockChart.rested": [{}],
    },
    depth: 12,
  });
  expect(r.states.length).toBeGreaterThan(20);
  expect(coverage(restockChart, r)).toEqual({ unreached: [], dead: [] });
  for (const s of r.states) {
    expect(s.data.putBack).toBeLessThanOrEqual(s.data.next);
    expect(s.data.next).toBeLessThanOrEqual(s.data.staples.length);
    expect(s.state === "done").toBe(s.data.next === s.data.staples.length);
  }
});

it("keeps each chart event deterministic and undoable", async () => {
  for (const t of events) await properties(t, { runs: 100, seed: 17 });
});

it("puts a name back once: still to buy stays, bought goes back, new joins below 50", () => {
  const milk = { id: id(), name: "Milk", qty: 3, bought: false };
  const fresh = id();
  expect(putBackIn([milk], { id: fresh, name: "Milk" })).toEqual([milk]);
  expect(putBackIn([{ ...milk, bought: true }], { id: fresh, name: "Milk" })).toEqual([{ ...milk, qty: 1 }]);
  expect(putBackIn([], { id: fresh, name: "Milk" })).toEqual([{ id: fresh, name: "Milk", qty: 1, bought: false }]);
  const full = Array.from({ length: 50 }, (_, n) => ({ id: id(), name: `N${n}`, qty: 1, bought: false }));
  expect(putBackIn(full, { id: fresh, name: "Milk" })).toEqual(full);
  for (const items of [[], [milk], [{ ...milk, bought: true }], full]) {
    const once = putBackIn(items, { id: id(), name: "Milk" });
    expect(putBackIn(once, { id: id(), name: "Milk" })).toEqual(once);
  }
});

it("shows the run started last, and counts a done run's staples as handled", () => {
  expect(runsOf({})).toEqual({ last: null, kept: 0 });
  const older = { state: "done", data: { ...data, at: 1, next: 5, putBack: 4 } };
  const newer = { state: "resting", data: { ...data, at: 2, next: 2, putBack: 2, by: "schedule" as const } };
  expect(runsOf({ a: older, b: newer })).toEqual({
    last: { by: "schedule", at: 2, state: "running", putBack: 2, handled: 2, total: 5, code: "" },
    kept: 2,
  });
  expect(runsOf({ a: { ...older, state: "failed", data: { ...older.data, code: "x" } } }).last?.state).toBe("failed");
});
