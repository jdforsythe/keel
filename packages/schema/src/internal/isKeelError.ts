import type { KeelError } from "../KeelError.ts";

/** Whether `x` has a `KeelError`'s shape: an object with a string `code`, a string `message` and an own `data`. */
export function isKeelError(x: unknown): x is KeelError<string, unknown> {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof Reflect.get(x, "code") === "string" &&
    typeof Reflect.get(x, "message") === "string" &&
    Object.hasOwn(x, "data")
  );
}
