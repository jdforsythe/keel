import { stores } from "@keel/store";

/** Every registered store's snapshot keyed by store id (k.store), for `#k-state`. */
export function snapshotStores(): Readonly<Record<string, unknown>> {
  return Object.fromEntries([...stores()].map(([id, s]) => [id, s.snapshot()]));
}
