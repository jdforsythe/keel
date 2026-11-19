import { tx } from "@keel/store";
import type { Transaction } from "@keel/store";

/**
 * One transaction property case: from `state` (restored as the store's base, empty log), `tx(t, payload)` commits
 * (payload and output parse, every declared `invariant` holds), `undo` restores `state`, and a second `tx` gives the
 * same output. The store is restored to its snapshot from before the case, log `meta` included.
 */
export function checkTransaction<T, P>(t: Transaction<T, P>, state: T, payload: P): void {
  const st = t.store;
  const original = st.snapshot({ meta: true });
  try {
    const seeded = st.restore({ state, log: [], initial: state });
    if (!seeded.ok) throw new Error(`generated state rejected by ${st.id}: ${seeded.error.message}`);
    const input = JSON.stringify(st.snapshot().state);
    const first = tx(t, payload);
    if (!first.ok) {
      if (first.error.code === "store.invariant") throw new Error("invariant failed");
      throw new Error(`${t.name} returned ${first.error.code}`);
    }
    const output = JSON.stringify(st.snapshot().state);
    st.undo();
    if (JSON.stringify(st.snapshot().state) !== input)
      throw new Error(`undo after ${t.name} did not restore the input`);
    const again = tx(t, payload);
    if (!again.ok || JSON.stringify(st.snapshot().state) !== output)
      throw new Error(`${t.name} gave different outputs for equal inputs`);
  } finally {
    st.restore(original);
  }
}
