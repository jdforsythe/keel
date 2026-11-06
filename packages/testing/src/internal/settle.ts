import { stores } from "@keel/store";
import { fail } from "./fail.ts";

/** Rounds `settle` waits at most before reporting work that never goes quiet. */
const MAX_ROUNDS = 50;
/** Microtask hops per round: one `await Promise.resolve()` each, so short promise chains finish inside a round. */
const ROUND_HOPS = 16;
/** Consecutive quiet rounds that count as settled. */
const QUIET_ROUNDS = 2;

const logSizes = (): string => [...stores()].map(([id, st]) => `${id}:${st.log().length}`).join(",");

/**
 * Run `act`, then wait without timers until triggered work is quiescent: rounds of microtask hops, done after
 * two consecutive rounds with no DOM mutation under `root` (MutationObserver) and no change in any store's log
 * length. More than 50 rounds throws `keel.unexpected` "fire did not settle". Deterministic: no clock, no timers.
 */
export async function settle(root: Element, act: () => void): Promise<void> {
  let mutations = 0;
  const observer = new MutationObserver((records) => {
    mutations += records.length;
  });
  observer.observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
  try {
    act();
    let quiet = 0;
    let last = logSizes();
    for (let round = 0; round < MAX_ROUNDS; round++) {
      for (let hop = 0; hop < ROUND_HOPS; hop++) await Promise.resolve();
      mutations += observer.takeRecords().length;
      const sizes = logSizes();
      const active = mutations > 0 || sizes !== last;
      mutations = 0;
      last = sizes;
      quiet = active ? 0 : quiet + 1;
      if (quiet === QUIET_ROUNDS) return;
    }
    throw fail("keel.unexpected", "fire did not settle", { rounds: MAX_ROUNDS });
  } finally {
    observer.disconnect();
  }
}
