import type { Scope } from "@keel/reactive";
import type { Secret } from "@keel/schema";
import type { Factory, Held } from "@keel/store/internal";
import type { Caller } from "./Caller.ts";

/**
 * The isolated scope one request runs in (k.store `isolate`): the stores created inside it go in `#k-state`. `caller`
 * is who sent it (`callerOf`); `bearer` its `Authorization: Bearer` token on an API route, else `undefined` (`bearerOf`,
 * k.api Bearer); `allowed`, whether its `Origin` is an allowed origin and its route an API route
 * (k.hosting); `held` is this request's instance of each `stores` factory opened so far (`openStores` from `@keel/store/internal`, whose `StateRequest` this satisfies); `pii` the
 * `.pii()` values of its decoded action input, its loaders' outputs and its factories' store states, which its `diag`
 * records and its `keel.unexpected` messages never hold (k.privacy Server log, `scrubbed`); `secrets` the revealed
 * value of each `Secret` made or revealed while the request runs (`noteRequestSecrets`), its input and `bearer` among them, which
 * they never hold either (`redacted`); an event stream keeps the same set, so a secret its loader makes later is in it.
 */
export type RequestScope = {
  readonly scope: Scope;
  readonly caller: Caller;
  readonly bearer: Secret<string> | undefined;
  readonly allowed: boolean;
  readonly held: Map<Factory, Promise<Held>>;
  readonly pii: Set<string>;
  readonly secrets: Set<string>;
};
