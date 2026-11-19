import type { Scope } from "@keel/reactive";
import type { Factory } from "./Factory.ts";
import type { Held } from "./Held.ts";

/** What the runner needs of one request: the isolated `scope` it runs in and `held`, its instance of each `stores` factory opened so far (`openStores`). */
export type StateRequest = {
  readonly scope: Scope;
  readonly held: Map<Factory, Promise<Held>>;
};
