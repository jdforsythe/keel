import type { Registered } from "./Registered.ts";

/** Every route registered by `manifest()` in this process (the deployable's union); read by `href` and `Form`. */
export const routeTable = new Map<string, Registered>();
