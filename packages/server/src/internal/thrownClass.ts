import { isDefect } from "@keel/schema";
import { attempted } from "./attempted.ts";

/** The `Error` names a log writes as they are (k.serverlog Thrown values); any other name is written `Error`. */
const NAMES: ReadonlySet<string> = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "SyntaxError",
  "ReferenceError",
  "URIError",
  "EvalError",
  "AggregateError",
  "AbortError",
  "TimeoutError",
]);

/** Whether `x` has a `KeelError`'s shape: an object with a string `code`, a string `message` and an own `data`. */
const keelShaped = (x: object): boolean =>
  typeof Reflect.get(x, "code") === "string" &&
  typeof Reflect.get(x, "message") === "string" &&
  Object.hasOwn(x, "data");

/**
 * The class a log writes for a thrown value or a cause (k.serverlog Thrown values), from a closed list: `Defect` for a
 * defect, `Result` for a `KeelError`, an `Error`'s `name` when it is one of `NAMES` (else `Error`), `value` for anything
 * else. Every read runs inside `attempted`, so a value whose reads throw (a Proxy) is `value`; never throws.
 */
export function thrownClass(x: unknown): string {
  const read = attempted(() => {
    if (isDefect(x)) return "Defect";
    if (x instanceof Error) {
      const name: unknown = Reflect.get(x, "name");
      return typeof name === "string" && NAMES.has(name) ? name : "Error";
    }
    return typeof x === "object" && x !== null && keelShaped(x) ? "Result" : "value";
  });
  return read.ok ? read.value : "value";
}
