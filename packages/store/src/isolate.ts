import type { Scope } from "@keel/reactive";
import { ownRegistry } from "./internal/ownRegistry.ts";

/**
 * Give `sc` its own store registry (k.store Ids, RFC 0022): stores created under it (and its descendants) register
 * there, `stores()` called under it lists only them, and a live duplicate id throws only within it. Stores created
 * outside every isolated scope share the module registry. The registry is dropped when `sc` is disposed. Idempotent.
 */
export function isolate(sc: Scope): void {
  ownRegistry(sc);
}
