import type { Store } from "@keel/store";
import { stores } from "@keel/store";
import type { SettleWatch } from "./SettleWatch.ts";
import { drained } from "./drained.ts";
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
 * route id; after the busy turns, naming their count and unit). Without `root` only store logs count. `registry` lists the live stores (default `stores()`; a fresh module
 * graph's own for `resumeDocument`). No timers. `watch` reports to the `simulate` run
 * that owns the ctx's clock that the call is in progress, and that it is stalled (busy, nothing moving after a macrotask
 * turn) so the run's drive may move the clock for it (k.sim Driving); the call moves no clock itself.
 */
export async function settle(
  root: Element | undefined,
  act: () => void,
  busy: () => string | null = () => null,
  registry: () => ReadonlyMap<string, Store<unknown>> = stores,
  watch: SettleWatch = () => ({ stalled: () => {}, end: () => {} }),
): Promise<void> {
  const report = watch();
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
          throw fail(
            "keel.unexpected",
            `fire did not settle: ${pending} still loading after ${MAX_BUSY_TURNS} macrotask turns`,
            {
              rounds: round,
              route: pending,
            },
          );
        await drained();
        report.stalled(!changed() && busy() !== null);
        quiet = 0;
        continue;
      }
      report.stalled(false);
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
    report.end();
    observer?.disconnect();
  }
}
