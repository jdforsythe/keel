import type { Signal } from "@keel/reactive";
import type { Owner } from "./Owner.ts";

/** What an effect under `owner` may write: the nearest Boundary's state (to report a throw). */
export function writesOf(owner: Owner): Signal<unknown>[] {
  return owner.catcher === null ? [] : [owner.catcher.state];
}
