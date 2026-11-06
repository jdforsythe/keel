import { stores, tx } from "@keel/store";
import type { Snapshot, Store, Transaction } from "@keel/store";

/**
 * One transaction property case from the current live state: `tx(t, payload)` commits (payload and output parse,
 * every declared `invariant` holds), `undo` restores the input, and equal inputs give equal outputs.
 * Every store the case changed is restored afterwards.
 */
export function checkTransaction<T, P>(t: Transaction<T, P>, payload: P): void {
  const before = new Map<string, readonly [Store<unknown>, Snapshot<unknown>]>();
  for (const [id, st] of stores()) before.set(id, [st, st.snapshot()]);
  try {
    const first = tx(t, payload);
    if (!first.ok) {
      if (first.error.code === "store.invariant") throw new Error("invariant failed");
      throw new Error(`${t.name} returned ${first.error.code}`);
    }
    const changed = [...before.values()].find(([st, snap]) => st.log().length !== snap.log.length);
    if (changed === undefined) throw new Error(`${t.name} committed to no live store`);
    const [st, snap] = changed;
    const output = JSON.stringify(st.snapshot().state);
    st.undo();
    if (JSON.stringify(st.snapshot().state) !== JSON.stringify(snap.state))
      throw new Error(`undo after ${t.name} did not restore the input state`);
    const again = tx(t, payload);
    if (!again.ok || JSON.stringify(st.snapshot().state) !== output)
      throw new Error(`${t.name} gave different outputs for equal inputs`);
  } finally {
    for (const [st, snap] of before.values()) if (st.log().length !== snap.log.length) st.restore(snap);
  }
}
