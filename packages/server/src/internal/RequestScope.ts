import type { Scope } from "@keel/reactive";

/** The scope one request runs in, and the ids of the stores created inside it (they go in `#k-state`). */
export type RequestScope = { readonly scope: Scope; readonly created: Set<string> };
