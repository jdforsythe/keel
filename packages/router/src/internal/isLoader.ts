import { isSchema } from "@keel/schema";
import type { Loader } from "../types/Loader.ts";
import { LOADER_KEY } from "./LOADER_KEY.ts";
import { ownValue } from "./ownValue.ts";

/** Whether `v` is a value `loader(contract, id, decl, fn)` made: a key guard on its mark. */
export function isLoader(v: unknown): v is Loader {
  return (
    typeof v === "object" &&
    v !== null &&
    ownValue(v, "kind") === "keel.loader" &&
    typeof ownValue(v, "run") === "function" &&
    isSchema(ownValue(v, "output")) &&
    Object.hasOwn(v, LOADER_KEY)
  );
}
