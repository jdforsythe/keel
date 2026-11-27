import type { KeelError } from "../KeelError.ts";

/**
 * Whether `x` has a `KeelError`'s shape: an object with a string `code`, a string `message`, an own `data` and a
 * `cause` that is absent or of that shape too.
 */
export function isKeelError(x: unknown): x is KeelError<string, unknown> {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof Reflect.get(x, "code") === "string" &&
    typeof Reflect.get(x, "message") === "string" &&
    Object.hasOwn(x, "data") &&
    (Reflect.get(x, "cause") === undefined || isKeelError(Reflect.get(x, "cause")))
  );
}
