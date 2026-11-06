import type { RouterCore } from "./RouterCore.ts";

/**
 * The router whose chain is rendering right now (set only for the duration of a render, like the runtime's
 * render context). `Form` reads it at call time to intercept submit; outside a router render it is `null`.
 */
export const active: { core: RouterCore | null } = { core: null };
