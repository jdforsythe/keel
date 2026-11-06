import type { Result } from "./Result.ts";
import { err } from "./err.ts";
import type { UnexpectedError } from "./internal/UnexpectedError.ts";
import { toUnexpected } from "./internal/toUnexpected.ts";
import { ok } from "./ok.ts";

type Attempted<T> = [T] extends [never]
  ? Result<never, UnexpectedError>
  : T extends PromiseLike<infer U>
    ? Promise<Result<U, UnexpectedError>>
    : Result<T, UnexpectedError>;

const isThenable = (x: unknown): x is PromiseLike<unknown> =>
  (typeof x === "object" || typeof x === "function") && x !== null && typeof Reflect.get(x, "then") === "function";

/**
 * The only sanctioned catch (k.errors). Runs `fn`; a sync fn gives a Result, an async fn a Promise of one.
 * A throw or rejection becomes `err` with code `keel.unexpected`. Never throws or rejects.
 */
export function attempt<T>(fn: () => T): Attempted<T>;
export function attempt(
  fn: () => unknown,
): Result<unknown, UnexpectedError> | Promise<Result<unknown, UnexpectedError>> {
  try {
    const value = fn();
    if (!isThenable(value)) return ok(value);
    return Promise.resolve(value).then(ok, (thrown: unknown) => err(toUnexpected(thrown)));
  } catch (thrown) {
    return err(toUnexpected(thrown));
  }
}
