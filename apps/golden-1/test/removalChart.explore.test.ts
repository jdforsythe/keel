import { coverage } from "@keel/std-statecharts";
import { explore, properties } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { removalChart } from "../modules/api/removalChart.ts";

describe("removalChart", () => {
  it("closes over every state and payload: each state reached, none stuck", () => {
    const r = explore(Object.values(removalChart.events));
    expect(r.complete).toBe(true);
    const names = r.states.map((v) => (typeof v === "object" && v !== null && "state" in v ? v.state : undefined));
    expect(new Set(names)).toEqual(new Set(Object.keys(removalChart.states)));
    expect(coverage(removalChart, r)).toEqual({ unreached: [], dead: [] });
  });

  it("each event's transaction passes properties", async () => {
    for (const event of Object.values(removalChart.events)) await properties(event, { runs: 100, seed: 11 });
  });

  it("an undo or a failed purge leads to restoring; only a purge ends removed", () => {
    const hidden = { state: "hidden" as const, data: {} };
    expect(removalChart.next(hidden, "undo", {}).state).toBe("restoring");
    expect(removalChart.next(hidden, "expired", {}).state).toBe("purging");
    const purging = { state: "purging" as const, data: {} };
    expect(removalChart.next(purging, "purgeFailed", { code: "workflows.attempts" }).state).toBe("restoring");
    expect(removalChart.next(purging, "purged", {}).state).toBe("removed");
    const restoring = { state: "restoring" as const, data: {} };
    expect(removalChart.next(restoring, "restored", {}).state).toBe("kept");
    expect(removalChart.next(restoring, "restoreFailed", { code: "api.restoreFailed" }).state).toBe("stuck");
  });
});
