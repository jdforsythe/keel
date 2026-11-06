import type { Scope } from "@keel/reactive";
import type { Store } from "../types/Store.ts";

/**
 * Live stores by id (RFC 0022): `shared` for scopes outside every isolated scope (the module registry), `own` per
 * isolated scope (`isolate`). Entries leave when the owning scope is disposed.
 */
export const registries: {
  readonly shared: Map<string, Store<unknown>>;
  readonly own: WeakMap<Scope, Map<string, Store<unknown>>>;
} = { shared: new Map(), own: new WeakMap() };
