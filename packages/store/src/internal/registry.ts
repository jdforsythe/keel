import type { Store } from "../types/Store.ts";

/** Live stores by id (module-level; entries leave when the owning scope is disposed). */
export const registry = new Map<string, Store<unknown>>();
