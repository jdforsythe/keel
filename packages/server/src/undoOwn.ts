import type { Store } from "@keel/store";
import { canUndoOwn } from "./canUndoOwn.ts";

/**
 * Undo `st`'s last transaction only when the current request's caller committed it (`canUndoOwn`); true when it did.
 * A process-shared store is never undone on behalf of another caller (finding 0082). Call synchronously in an action.
 */
export function undoOwn(st: Pick<Store<unknown>, "log" | "undo">): boolean {
  return canUndoOwn(st) && st.undo();
}
