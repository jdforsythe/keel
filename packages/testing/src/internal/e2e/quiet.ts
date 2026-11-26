/// <reference path="./PageApi.ts" />
// The page script's globals (`__keelE2e`, `__keelProblem`) are declared in PageApi.ts.
import type { TabState } from "./TabState.ts";
import { busy } from "./busy.ts";
import { ensureScript } from "./ensureScript.ts";
import { lostContext } from "./lostContext.ts";
import { nextChange } from "./nextChange.ts";

/**
 * Resolves `true` once the tab is quiet (k.e2e-page Waits): nothing it sent unanswered but event streams, no navigation
 * under way, and an animation frame with no DOM change; `false` when `deadline` (a `performance.now()` time) passes
 * first. It waits on the tab's events and the page's frames, never on a time.
 */
export async function quiet(state: TabState, deadline: number): Promise<boolean> {
  for (;;) {
    const left = deadline - performance.now();
    if (left <= 0) return false;
    if (busy(state)) {
      await nextChange(state, left);
      continue;
    }
    let calm: boolean;
    try {
      await ensureScript(state.tab);
      calm = await state.tab.evaluate((ms) => globalThis.__keelE2e?.calm(ms) ?? true, left);
    } catch (e) {
      if (lostContext(e)) continue;
      throw e;
    }
    if (!calm) return false;
    if (!busy(state)) return true;
  }
}
