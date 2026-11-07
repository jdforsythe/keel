import type { Store } from "@keel/store";
import { ownCaller } from "./internal/ownCaller.ts";

/**
 * Whether `undoOwn(st)` would undo (finding 0082): the last entry of `st`'s log was committed by an action of the
 * current request's caller (its `keel-caller` cookie). False outside a request scope, after an `await`, for a caller
 * without the cookie, and when another caller wrote last. Call synchronously in a loader or action.
 */
export function canUndoOwn(st: Pick<Store<unknown>, "log">): boolean {
  const c = ownCaller();
  const last = st.log().at(-1);
  return c?.token !== undefined && last !== undefined && c.tags.get(last) === c.token;
}
