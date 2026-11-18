import type { Store } from "@keel/store";
import { stores } from "@keel/store";

/** Every live store's committed state keyed by store id (k.store `stores()`, or `live`), as JSON-safe copies. */
export function storeValues(live: ReadonlyMap<string, Store<unknown>> = stores()): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [id, st] of live) out[id] = st.snapshot().state;
  return out;
}
