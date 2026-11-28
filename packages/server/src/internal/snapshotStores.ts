import { stores } from "@keel/store";
import type { Req } from "./Req.ts";

/**
 * Snapshots keyed by store id for `#k-state` (k.leave Snapshots): the stores of this request's registry whose ids are
 * in `touched`, those an island level's render created, looked up or read. `stores` factory instances live in their own
 * isolated child scopes and never appear (k.server Server state); module-level stores are process-wide and never appear.
 */
export function snapshotStores(r: Req, touched: ReadonlySet<string>): Readonly<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const [id, st] of r.rq.scope.run(stores)) if (touched.has(id)) out[id] = st.snapshot();
  return out;
}
