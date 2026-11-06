import { stores } from "@keel/store";
import type { Req } from "./Req.ts";

/**
 * Snapshots keyed by store id for `#k-state` (k.store): every store in this request's registry, then those listed in
 * `createApp({ expose })` from the module registry. Those are process-shared, so they carry their state only
 * (`{ state, log: [], initial: state }`, RFC 0022) unless exposed with `log: true`. A request store shadows a module
 * store with the same id.
 */
export function snapshotStores(r: Req): Readonly<Record<string, unknown>> {
  const own = r.rq.scope.run(stores);
  const shared = stores();
  const out: Record<string, unknown> = {};
  for (const [id, log] of r.sv.expose) {
    const snap = shared.get(id)?.snapshot();
    if (snap !== undefined) out[id] = log ? snap : { state: snap.state, log: [], initial: snap.state };
  }
  for (const [id, st] of own) out[id] = st.snapshot();
  return out;
}
