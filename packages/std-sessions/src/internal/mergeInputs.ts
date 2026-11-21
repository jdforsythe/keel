import type { SessionEvent } from "../SessionEvent.ts";
import { isInput } from "./isInput.ts";

/**
 * `inputs` (recorded, kept as they were) merged with the observations of `replayed`, a replay's events in occurrence
 * order: each input the replay recorded is taken from `inputs` in turn. When the replay recorded a different number
 * of inputs, the merge falls back to order by `at`, inputs first among equal times.
 */
export function mergeInputs(inputs: readonly SessionEvent[], replayed: readonly SessionEvent[]): SessionEvent[] {
  const observed = replayed.filter((e) => !isInput(e));
  if (replayed.length - observed.length === inputs.length) {
    let next = 0;
    return replayed.map((e) => (isInput(e) ? (inputs[next++] ?? e) : e));
  }
  const tagged = [...inputs.map((e, i) => ({ e, k: 0, i })), ...observed.map((e, i) => ({ e, k: 1, i }))];
  tagged.sort((a, b) => a.e.at - b.e.at || a.k - b.k || a.i - b.i);
  return tagged.map((t) => t.e);
}
