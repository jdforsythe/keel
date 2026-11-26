import { objectSchemaOf } from "../../unsafe/objectSchemaOf.ts";
import type { Action } from "../types/Action.ts";
import type { ApiAction } from "../types/ApiAction.ts";
import { ACTION_KEY } from "./ACTION_KEY.ts";
import { ownValue } from "./ownValue.ts";

/** Whether `v` is a value `action(contract, id, decl, fn)` made (a page's or an API entry's): a key guard on its mark. */
export function isAction(v: unknown): v is Action | ApiAction {
  return (
    typeof v === "object" &&
    v !== null &&
    ownValue(v, "kind") === "keel.action" &&
    typeof ownValue(v, "run") === "function" &&
    objectSchemaOf(ownValue(v, "input")) !== undefined &&
    Object.hasOwn(v, ACTION_KEY)
  );
}
