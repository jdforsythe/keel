import type { Scope } from "@keel/reactive";
import type { Caller } from "./Caller.ts";
import type { Factory } from "./Factory.ts";
import type { Held } from "./Held.ts";

/**
 * The isolated scope one request runs in (k.store `isolate`): the stores created inside it go in `#k-state`. `caller`
 * is who sent it (`callerOf`); `allowed`, whether its `Origin` is an allowed origin and its route an API route
 * (k.hosting); `held` is this request's instance of each `stores` factory opened so far (`openStores`).
 */
export type RequestScope = {
  readonly scope: Scope;
  readonly caller: Caller;
  readonly allowed: boolean;
  readonly held: Map<Factory, Promise<Held>>;
};
