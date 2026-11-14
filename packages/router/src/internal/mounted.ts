import type { RouterCore } from "./RouterCore.ts";

/** Routers whose `App` is mounted, in mount order; `findRouter` takes the only one when no `App` scope encloses the caller. */
export const mounted: RouterCore[] = [];
