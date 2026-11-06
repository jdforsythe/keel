import { registry } from "./internal/registry.ts";
import type { Store } from "./types/Store.ts";

/** Live stores by id: those whose owning scope is not disposed. */
export function stores(): ReadonlyMap<string, Store<unknown>> {
  return registry;
}
