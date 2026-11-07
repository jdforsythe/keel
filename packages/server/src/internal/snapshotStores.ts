import { stores } from "@keel/store";
import type { Req } from "./Req.ts";

/**
 * Snapshots keyed by store id for `#k-state` (k.store): every store in this request's registry. `stores` factory
 * instances live in their own isolated child scopes and never appear (k.server Server state); module-level stores
 * are process-wide and their state is their initial state, which the client already has.
 */
export function snapshotStores(r: Req): Readonly<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const [id, st] of r.rq.scope.run(stores)) out[id] = st.snapshot();
  return out;
}
