import type { TabState } from "./TabState.ts";

/**
 * Whether the tab is not quiet on the network side (k.e2e-page Waits): a request it sent has no answer (a held page's
 * parked scripts aside), or a navigation is under way (its document has not fired `load`, unless its scripts are held).
 */
export function busy(state: TabState): boolean {
  const parked = new Set(state.parked.map((r) => r.request()));
  for (const r of state.inflight) if (!parked.has(r)) return true;
  return !state.loaded && !state.holding;
}
