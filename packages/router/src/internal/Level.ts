import type { Def } from "./Def.ts";

/** One entry of a route's chain (its layouts, outermost first, then the route). */
export type Level = { readonly id: string; readonly def: Def };
