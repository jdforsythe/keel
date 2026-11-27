import type { Action } from "../types/Action.ts";
import type { ApiAction } from "../types/ApiAction.ts";
import { records } from "./records.ts";

/** Whether `v` is a value `action(contract, id, decl, fn)` made (a page's or an API entry's) in this realm (k.identity), read from the router's record, never from a property. */
export function isAction(v: unknown): v is Action | ApiAction {
  return typeof v === "object" && v !== null && records.action.has(v);
}
