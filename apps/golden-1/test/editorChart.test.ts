import { coverage } from "@keel/std-statecharts";
import { explore, properties } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { EditorData } from "../modules/todos/EditorData.schema.ts";
import { editorChart } from "../modules/todos/editorChart.ts";

describe("editorChart", () => {
  it("closes over every state and payload: each state reached, none stuck", () => {
    const r = explore(Object.values(editorChart.events));
    expect(r.complete).toBe(true);
    const names = r.states.map((v) => (typeof v === "object" && v !== null && "state" in v ? v.state : undefined));
    expect(new Set(names)).toEqual(new Set(Object.keys(editorChart.states)));
    expect(coverage(editorChart, r)).toEqual({ unreached: [], dead: [] });
  });

  it("each event's transaction passes properties", async () => {
    for (const event of Object.values(editorChart.events)) await properties(event, { runs: 100, seed: 11 });
  });

  it("starts viewing with no tries and caps tries at 3", () => {
    expect(editorChart.initial).toBe("viewing");
    expect(EditorData.parse({ attempts: 4 }).ok).toBe(false);
    const conflict: Parameters<typeof editorChart.enabled>[0] = { state: "conflict", data: { attempts: 3 } };
    expect(editorChart.enabled(conflict, "mine", {})).toBe(false);
    expect(editorChart.enabled(conflict, "theirs", {})).toBe(true);
  });
});
