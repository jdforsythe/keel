import type { Scope } from "@keel/reactive";
import type { RouterCore } from "./RouterCore.ts";

/** The scope each `router.App` render owns -> that router. `Form` walks its owner chain to find one. */
export const routers = new WeakMap<Scope, RouterCore>();
