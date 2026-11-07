import { owner } from "@keel/reactive";
import type { Caller } from "./Caller.ts";
import { callers } from "./callers.ts";

/** The caller of the request whose scope is on the current `owner()` chain; undefined outside one (or after an await). */
export function ownCaller(): Caller | undefined {
  for (let sc = owner(); sc !== undefined; sc = sc.parent) {
    const c = callers.get(sc);
    if (c !== undefined) return c;
  }
  return undefined;
}
