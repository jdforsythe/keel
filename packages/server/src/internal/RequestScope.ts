import type { Scope } from "@keel/reactive";

/** The isolated scope one request runs in (k.store `isolate`): the stores created inside it go in `#k-state`. */
export type RequestScope = { readonly scope: Scope };
