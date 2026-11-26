import type { ApiGuard } from "../types/ApiGuard.ts";
import { GUARD_KEY } from "./GUARD_KEY.ts";
import { ownValue } from "./ownValue.ts";

/** Whether `v` is a value `guard(decl, fn)` made: a key guard on its mark. */
export function isGuard(v: unknown): v is ApiGuard {
  return (
    typeof v === "object" &&
    v !== null &&
    ownValue(v, "kind") === "keel.guard" &&
    typeof ownValue(v, "run") === "function" &&
    Object.hasOwn(v, GUARD_KEY)
  );
}
