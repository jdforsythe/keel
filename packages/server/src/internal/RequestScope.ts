import type { Scope } from "@keel/reactive";
import type { Caller } from "./Caller.ts";
import type { Factory } from "./Factory.ts";
import type { Held } from "./Held.ts";

/**
 * The isolated scope one request runs in (k.store `isolate`): the stores created inside it go in `#k-state`. `caller`
 * is who sent it (`callerOf`); `held` is this request's instance of each `stores` factory opened so far (`openStores`).
 */
export type RequestScope = {
  readonly scope: Scope;
  readonly caller: Caller;
  readonly held: Map<Factory, Promise<Held>>;
};
