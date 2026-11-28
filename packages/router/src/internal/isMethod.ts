import type { Method } from "../contract/types/Method.ts";

/** Whether `v` is an API entry's `method`: one of `METHODS`. */
export function isMethod(v: unknown): v is Method {
  return v === "GET" || v === "POST" || v === "PUT" || v === "PATCH" || v === "DELETE";
}
