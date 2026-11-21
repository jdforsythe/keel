import type { Loader } from "../types/Loader.ts";
import { isSchema } from "./isSchema.ts";
import { ownValue } from "./ownValue.ts";

/** Whether `v` is a value `loader(contract, id, decl, fn)` made. */
export function isLoader(v: unknown): v is Loader {
  return (
    typeof v === "object" &&
    v !== null &&
    ownValue(v, "kind") === "keel.loader" &&
    typeof ownValue(v, "run") === "function" &&
    isSchema(ownValue(v, "output"))
  );
}
