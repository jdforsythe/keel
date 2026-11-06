import type { Scope } from "@keel/reactive";
import type { Store } from "../types/Store.ts";
import { registries } from "./registries.ts";

/** The registry of the nearest isolated scope on `sc`'s chain (`sc` itself included), else the module registry. */
export function registryOf(sc: Scope | undefined): Map<string, Store<unknown>> {
  for (let at = sc; at !== undefined; at = at.parent) {
    const r = registries.own.get(at);
    if (r !== undefined) return r;
  }
  return registries.shared;
}
