import { owner } from "@keel/reactive";
import type { RouterCore } from "./RouterCore.ts";
import { mounted } from "./mounted.ts";
import { routers } from "./routers.ts";

/**
 * The router whose `App` scope encloses the running code (nearest via `owner()` then `.parent`), else the last router
 * whose `App` is mounted (an event handler runs outside any scope), else null.
 */
export function findRouter(): RouterCore | null {
  for (let s = owner(); s !== undefined; s = s.parent) {
    const core = routers.get(s);
    if (core !== undefined) return core;
  }
  return mounted.at(-1) ?? null;
}
