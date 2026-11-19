import { owner } from "@keel/reactive";
import type { RouterCore } from "./RouterCore.ts";
import { mounted } from "./mounted.ts";
import { routers } from "./routers.ts";

/**
 * The router whose `App` scope encloses the running code (nearest via `owner()` then `.parent`), else the one router
 * whose `App` is mounted (an event handler runs outside any scope); null with none or several mounted.
 */
export function findRouter(): RouterCore | null {
  for (let s = owner(); s !== undefined; s = s.parent) {
    const core = routers.get(s);
    if (core !== undefined) return core;
  }
  return mounted.length === 1 ? (mounted[0] ?? null) : null;
}
