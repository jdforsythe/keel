import { owner } from "@keel/reactive";
import { registryOf } from "./internal/registryOf.ts";
import type { Store } from "./types/Store.ts";

/**
 * Live stores by id (those whose owning scope is not disposed) in the caller's registry: the nearest isolated scope
 * on the `owner()` chain (`isolate`), else the module registry.
 */
export function stores(): ReadonlyMap<string, Store<unknown>> {
  return registryOf(owner());
}
