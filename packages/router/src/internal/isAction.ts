import type { Action } from "../types/Action.ts";
import type { ApiAction } from "../types/ApiAction.ts";
import { isObjectSchema } from "./isObjectSchema.ts";
import { ownValue } from "./ownValue.ts";

/** Whether `v` is a value `action(contract, id, decl, fn)` made (a page's or an API entry's). */
export function isAction(v: unknown): v is Action | ApiAction {
  return (
    typeof v === "object" &&
    v !== null &&
    ownValue(v, "kind") === "keel.action" &&
    typeof ownValue(v, "run") === "function" &&
    isObjectSchema(ownValue(v, "input"))
  );
}
