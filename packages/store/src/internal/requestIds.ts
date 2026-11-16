import type { Scope } from "@keel/reactive";
import type { Factory } from "./types/Factory.ts";

/** Per request scope, the factory that last opened each store id (`openHeld`): while it is held, the id is its own. */
export const requestIds: WeakMap<Scope, Map<string, Factory>> = new WeakMap();
