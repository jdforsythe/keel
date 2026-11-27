import { kernelSet } from "@keel/schema/internal";
import type { Action } from "../types/Action.ts";
import type { ApiAction } from "../types/ApiAction.ts";

/** Whether `v` is a value `action(contract, id, decl, fn)` made (a page's or an API entry's) in this realm (k.identity), read from the kernel's record, never from a property. */
export function isAction(v: unknown): v is Action | ApiAction {
  return typeof v === "object" && v !== null && kernelSet("router.action").has(v);
}
