import type { Scope } from "@keel/reactive";
import { devLoad } from "./devLoad.ts";
import { registries } from "./registries.ts";
import { registryPulse } from "./registryPulse.ts";

/**
 * End a `keel dev` load of the module registry (k.data Dev). The dev server module calls it once it has imported the
 * app's modules and made its apps, or failed to. Each carried store still holding its id (no store took it) leaves
 * the registry, and every carried store, whether it left or was taken over, has its owning scope disposed, its
 * effects and subscriptions with it, unless a store still in the registry is owned by that scope. The carried set and
 * the file are then cleared.
 */
export function storesLoaded(): void {
  let left = false;
  const ended = new Set<Scope>();
  for (const [id, held] of devLoad.carried) {
    if (registries.shared.get(id) === held) {
      registries.shared.delete(id);
      left = true;
    }
    const sc = devLoad.origins.get(held)?.scope;
    if (sc !== undefined) ended.add(sc);
  }
  devLoad.carried.clear();
  devLoad.file = undefined;
  for (const st of registries.shared.values()) {
    const sc = devLoad.origins.get(st)?.scope;
    if (sc !== undefined) ended.delete(sc);
  }
  for (const sc of ended) sc.dispose();
  if (left) registryPulse.fire();
}
