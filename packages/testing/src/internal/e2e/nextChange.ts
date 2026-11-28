import type { TabState } from "./TabState.ts";

/** Resolves on the tab's next tracked change, or after `ms`, whichever is first (a bound, not a sleep). */
export function nextChange(state: TabState, ms: number): Promise<void> {
  return new Promise((done) => {
    const wake = (): void => {
      state.waiters.delete(wake);
      clearTimeout(timer);
      done();
    };
    const timer = setTimeout(wake, Math.max(1, ms));
    state.waiters.add(wake);
  });
}
