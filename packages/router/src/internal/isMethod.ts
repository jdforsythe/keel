import type { Method } from "../contract/types/Method.ts";
import { METHODS } from "./METHODS.ts";

/** Whether `v` is an API entry's `method`. */
export function isMethod(v: unknown): v is Method {
  return METHODS.some((m) => m === v);
}
