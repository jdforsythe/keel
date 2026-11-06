import { owner } from "@keel/reactive";
import type { RouterCore } from "./RouterCore.ts";
import { routers } from "./routers.ts";

/** The router whose `App` scope encloses the running code (nearest via `owner()` then `.parent`), else null. */
export function findRouter(): RouterCore | null {
  for (let s = owner(); s !== undefined; s = s.parent) {
    const core = routers.get(s);
    if (core !== undefined) return core;
  }
  return null;
}
