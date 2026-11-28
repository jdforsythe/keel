import { type KeelError, type Result, err } from "@keel/schema";
import { passed } from "@keel/schema/internal";
import { unexpectedOf } from "./unexpectedOf.ts";

type Unexpected = KeelError<"keel.unexpected", { readonly cause: string }>;
type Attempted<T> = [T] extends [never]
  ? Result<never, Unexpected>
  : T extends PromiseLike<infer U>
    ? Promise<Result<U, Unexpected>>
    : Result<T, Unexpected>;

const isThenable = (x: unknown): boolean =>
  (typeof x === "object" || typeof x === "function") && x !== null && typeof Reflect.get(x, "then") === "function";

/**
 * `attempt` for the server: runs `fn`, a sync fn giving a Result and an async fn a Promise of one, a throw or rejection
 * `err` of `keel.unexpected`. What was thrown is read only through `unexpectedOf`, so a value whose `message`, `name`
 * or `toString` throws, or a Proxy, still gives a `keel.unexpected`, and a returned value whose `then` throws is a
 * rejection. Never throws or rejects.
 */
export function attempted<T>(fn: () => T): Attempted<T>;
export function attempted(fn: () => unknown): Result<unknown, Unexpected> | Promise<Result<unknown, Unexpected>> {
  try {
    const value = fn();
    if (!isThenable(value)) return passed(value);
    return Promise.resolve(value).then(passed, (thrown: unknown) => err(unexpectedOf(thrown)));
  } catch (thrown) {
    return err(unexpectedOf(thrown));
  }
}
