import type { Scope } from "@keel/reactive";
import { heldMap } from "@keel/schema/internal";
import type { WeakMapOf } from "@keel/schema/internal";
import type { Store } from "../types/Store.ts";

/**
 * Live stores by id: `shared` for scopes outside every isolated scope (the module registry), `own` per
 * isolated scope (`isolate`). Entries leave when the owning scope is disposed.
 */
export const registries: {
  readonly shared: Map<string, Store<unknown>>;
  readonly own: WeakMapOf<Scope, Map<string, Store<unknown>>>;
} = { shared: new Map(), own: heldMap() };
