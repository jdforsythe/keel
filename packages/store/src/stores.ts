import { owner } from "@keel/reactive";
import { registryOf } from "./internal/registryOf.ts";
import { registryPulse } from "./internal/registryPulse.ts";
import { storeReads } from "./internal/storeReads.ts";
import type { Store } from "./types/Store.ts";

/**
 * Live stores by id (those whose owning scope is not disposed) in the caller's registry: the nearest isolated scope
 * on the `owner()` chain (`isolate`), else the module registry. Reactive: an effect or computed reading it reruns when
 * a store joins or leaves a registry. While a read tap is set (`storeReads`), each `get` on it notes the id.
 */
export function stores(): ReadonlyMap<string, Store<unknown>> {
  registryPulse.read();
  const live = registryOf(owner());
  const note = storeReads.note;
  if (note === null) return live;
  // A copy whose `get` notes the id it looks up.
  const view = new Map(live);
  view.get = (id) => {
    note(id);
    return live.get(id);
  };
  return view;
}
