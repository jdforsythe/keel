import type { Store } from "@keel/store";
import { stores } from "@keel/store";
import { fail } from "./fail.ts";

/** Rounds `settle` waits at most before reporting work that never goes quiet. */
const MAX_ROUNDS = 50;
/**
 * Macrotask turns `settle` waits at most while `busy` names work in flight (a loader awaiting a first dynamic
 * `import()`, which resolves on I/O, not on microtasks). A turn count, not a clock: about seconds of I/O in practice.
 */
const MAX_BUSY_TURNS = 200_000;
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

const logSizes = (live: ReadonlyMap<string, Store<unknown>>): string =>
  [...live].map(([id, st]) => `${id}:${st.log().length}`).join(",");

/**
 * Run `act`, then wait without timers until triggered work is quiescent: rounds of microtask hops; a round that
 * saw no change then waits until the microtask queue has drained (one macrotask turn), so a silent
 * promise chain of any length finishes. Done after
 * two consecutive rounds with no DOM mutation under `root` (MutationObserver) and no change in any store's log
 * length, while `busy()` is null (it names a router navigation's route while one is in flight). A round while busy
 * with nothing moving waits one macrotask turn and does not count toward the 50 quiet-bound rounds; more than 50
 * moving rounds, or `MAX_BUSY_TURNS` busy turns, throws `keel.unexpected` "fire did not settle" (with the pending
 * route id). Without `root` only store logs count. `registry` lists the live stores (default `stores()`; a fresh module
 * graph's own for `resumeDocument`). Deterministic: no clock, no timers.
 */
export async function settle(
  root: Element | undefined,
  act: () => void,
  busy: () => string | null = () => null,
  registry: () => ReadonlyMap<string, Store<unknown>> = stores,
): Promise<void> {
  let mutations = 0;
  const observer =
    root === undefined
      ? undefined
      : new MutationObserver((records) => {
          mutations += records.length;
        });
  if (root !== undefined)
    observer?.observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
  try {
    act();
    let quiet = 0;
    let last = logSizes(registry());
    const changed = (): boolean => {
      mutations += observer?.takeRecords().length ?? 0;
      return mutations > 0 || logSizes(registry()) !== last;
    };
    let turns = 0;
    for (let round = 0; round < MAX_ROUNDS; ) {
      for (let hop = 0; hop < ROUND_HOPS; hop++) await Promise.resolve();
      // Only a round that looks quiet waits for the queue to drain: work that keeps writing never reaches it, so a
      // microtask loop that never stops still ends in "fire did not settle" instead of starving the macrotask.
      if (!changed() && busy() === null) await drained();
      const moved = changed();
      const pending = busy();
      mutations = 0;
      last = logSizes(registry());
      if (pending !== null && !moved) {
        // Waiting on I/O (a module load): one macrotask turn, counted apart from the quiet-bound rounds.
        if (++turns > MAX_BUSY_TURNS)
          throw fail("keel.unexpected", `fire did not settle: ${pending} still loading`, {
            rounds: round,
            route: pending,
          });
        await drained();
        quiet = 0;
        continue;
      }
      round++;
      quiet = moved || pending !== null ? 0 : quiet + 1;
      if (quiet === QUIET_ROUNDS) return;
    }
    const pending = busy();
    throw fail(
      "keel.unexpected",
      `fire did not settle${pending === null ? "" : `: ${pending} still loading`}`,
      pending === null ? { rounds: MAX_ROUNDS } : { rounds: MAX_ROUNDS, route: pending },
    );
  } finally {
    observer?.disconnect();
  }
}
