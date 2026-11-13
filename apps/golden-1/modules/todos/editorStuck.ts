import { editorChart } from "./editorChart.ts";

/** True when `editorChart` holds a refused edit that has used its 3 tries: Keep mine is off, Keep theirs remains. */
export function editorStuck(): boolean {
  const state = editorChart.store.get("state");
  const now = { state, data: editorChart.store.get("data") };
  return state === "conflict" && !editorChart.enabled(now, "mine", {});
}
