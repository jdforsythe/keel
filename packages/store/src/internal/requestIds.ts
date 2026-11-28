import type { Scope } from "@keel/reactive";
import { heldMap } from "@keel/schema/internal";
import type { WeakMapOf } from "@keel/schema/internal";
import type { Factory } from "./types/Factory.ts";

/** Per request scope, the factory that last opened each store id (`openHeld`): while it is held, the id is its own. */
export const requestIds: WeakMapOf<Scope, Map<string, Factory>> = heldMap();
