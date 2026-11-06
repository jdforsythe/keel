import { stores } from "@keel/store";

/** Every live store's committed state keyed by store id (k.store `stores()`), as JSON-safe copies. */
export function storeValues(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [id, st] of stores()) out[id] = st.snapshot().state;
  return out;
}
