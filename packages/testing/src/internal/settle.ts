import { stores } from "@keel/store";
import { fail } from "./fail.ts";

/** Rounds `settle` waits at most before reporting work that never goes quiet. */
const MAX_ROUNDS = 50;
/** Microtask hops per round before its macrotask turn: one `await Promise.resolve()` each. */
const ROUND_HOPS = 16;

/**
 * One macrotask turn: resolves after the microtask queue has drained, so a promise chain of any length started by
 * the event finishes inside the round. A `MessageChannel` message is a macrotask in Node and browsers alike with no
 * delay and no clock, so a simulated clock never sees it; never a timer
 * a test may have faked.
 */
const drained = (): Promise<void> =>
  new Promise((done) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = (): void => {
      channel.port1.close();
      done();
    };
    channel.port2.postMessage(0);
  });
/** Consecutive quiet rounds that count as settled. */
const QUIET_ROUNDS = 2;

const logSizes = (): string => [...stores()].map(([id, st]) => `${id}:${st.log().length}`).join(",");

/**
 * Run `act`, then wait without timers until triggered work is quiescent: rounds of microtask hops; a round that
 * saw no change then waits until the microtask queue has drained (one macrotask turn, RFC 0036), so a silent
 * promise chain of any length finishes. Done after
 * two consecutive rounds with no DOM mutation under `root` (MutationObserver) and no change in any store's log
 * length, while `busy()` is false (e.g. a router navigation in flight). More than 50 rounds throws `keel.unexpected`
 * "fire did not settle". Deterministic: no clock, no timers.
 */
export async function settle(root: Element, act: () => void, busy: () => boolean = () => false): Promise<void> {
  let mutations = 0;
  const observer = new MutationObserver((records) => {
    mutations += records.length;
  });
  observer.observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
  try {
    act();
    let quiet = 0;
    let last = logSizes();
    const active = (): boolean => {
      mutations += observer.takeRecords().length;
      return mutations > 0 || logSizes() !== last || busy();
    };
    for (let round = 0; round < MAX_ROUNDS; round++) {
      for (let hop = 0; hop < ROUND_HOPS; hop++) await Promise.resolve();
      // Only a round that looks quiet waits for the queue to drain: work that keeps writing never reaches it, so a
      // microtask loop that never stops still ends in "fire did not settle" instead of starving the macrotask.
      if (!active()) await drained();
      const moved = active();
      mutations = 0;
      last = logSizes();
      quiet = moved ? 0 : quiet + 1;
      if (quiet === QUIET_ROUNDS) return;
    }
    throw fail("keel.unexpected", "fire did not settle", { rounds: MAX_ROUNDS });
  } finally {
    observer.disconnect();
  }
}
