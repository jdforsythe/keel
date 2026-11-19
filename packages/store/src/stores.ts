import { owner } from "@keel/reactive";
import { registryOf } from "./internal/registryOf.ts";
import { registryPulse } from "./internal/registryPulse.ts";
import type { Store } from "./types/Store.ts";

/**
 * Live stores by id (those whose owning scope is not disposed) in the caller's registry: the nearest isolated scope
 * on the `owner()` chain (`isolate`), else the module registry. Reactive: an effect or computed reading it reruns when
 * a store joins or leaves a registry (rfc:0070).
 */
export function stores(): ReadonlyMap<string, Store<unknown>> {
  registryPulse.read();
  return registryOf(owner());
}
