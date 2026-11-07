import type { Scope } from "@keel/reactive";
import type { Caller } from "./Caller.ts";

/**
 * The isolated scope one request runs in (k.store `isolate`): the stores created inside it go in `#k-state`. `caller`
 * is who sent it (`callerOf`); `undoOwn` and `canUndoOwn` find it from the scope (`callers`).
 */
export type RequestScope = { readonly scope: Scope; readonly caller: Caller };
