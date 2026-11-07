import type { Snapshot, Store } from "@keel/store";
import { fail } from "./fail.ts";

/**
 * Restore each `[store, value]` as a fresh state (empty log, `value` as the undo base) and return every seeded
 * store's prior snapshot (log `meta` kept, rfc:0028), newest first, for `dispose` to put back. Each value is parsed by its store schema; on the
 * first invalid one, stores already set are put back and `schema.invalid` is thrown.
 */
export function seedStores(
  entries: readonly (readonly [Store<unknown>, unknown])[],
): (readonly [Store<unknown>, Snapshot<unknown>])[] {
  const done: (readonly [Store<unknown>, Snapshot<unknown>])[] = [];
  for (const [st, value] of entries) {
    const before = st.snapshot({ meta: true });
    const r = st.restore({ state: value, log: [], initial: value });
    if (!r.ok) {
      for (const [prev, snap] of done) prev.restore(snap);
      throw fail("schema.invalid", `state for store ${st.id}: ${r.error.message}`, r.error.data);
    }
    done.unshift([st, before]);
  }
  return done;
}
