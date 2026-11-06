import { stores } from "@keel/store";
import type { Req } from "./Req.ts";

/**
 * Snapshots keyed by store id for `#k-state` (k.store): only stores created inside this request's scope and
 * those listed in `createApp({ expose })`. Other module-level stores are process-shared data, not request state.
 */
export function snapshotStores(r: Req): Readonly<Record<string, unknown>> {
  const live = stores();
  const ids = new Set([...r.rq.created, ...r.sv.expose]);
  return Object.fromEntries(
    [...ids].flatMap((id) => [[id, live.get(id)?.snapshot()] as const]).filter(([, v]) => v !== undefined),
  );
}
