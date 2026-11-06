import type { Scope } from "@keel/reactive";
import { registries } from "./registries.ts";

/** Give `sc` its own registry (idempotent); it is dropped when `sc` is disposed. */
export function ownRegistry(sc: Scope): void {
  if (registries.own.has(sc)) return;
  registries.own.set(sc, new Map());
  sc.onDispose(() => registries.own.delete(sc));
}
