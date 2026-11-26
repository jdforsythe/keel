import type { KeelError } from "./KeelError.ts";
import type { Result } from "./Result.ts";
import { err } from "./err.ts";
import type { UnexpectedError } from "./internal/UnexpectedError.ts";
import { toUnexpected } from "./internal/toUnexpected.ts";
import { wrapsDefect } from "./internal/wrapsDefect.ts";
import { ok } from "./ok.ts";

type Settled<T, E> = [T] extends [never]
  ? Result<never, E>
  : T extends PromiseLike<infer U>
    ? Promise<Result<U, E>>
    : Result<T, E>;

const isThenable = (x: unknown): boolean =>
  (typeof x === "object" || typeof x === "function") && x !== null && typeof Reflect.get(x, "then") === "function";

/**
 * The only sanctioned catch (k.errors). Runs `fn`; a sync fn gives a Result, an async fn a Promise of one.
 * Without `expect`, a throw or rejection becomes `err` with code `keel.unexpected`, and the call never throws.
 * With `expect`, a thrown or rejected value that is no defect goes to `expect`: the KeelError it returns is the
 * `err`; for `undefined` the very value is thrown or rejected on. A defect, or a value wrapping one through `cause` and
 * `errors` in at most 8 steps, never reaches `expect`.
 */
export function attempt<T>(fn: () => T): Settled<T, UnexpectedError>;
export function attempt<T, E extends KeelError<string, unknown>>(
  fn: () => T,
  expect: (thrown: unknown) => E | undefined,
): Settled<T, E>;
export function attempt(
  fn: () => unknown,
  expect?: (thrown: unknown) => KeelError<string, unknown> | undefined,
): Result<unknown, KeelError<string, unknown>> | Promise<Result<unknown, KeelError<string, unknown>>> {
  const settle = (thrown: unknown): Result<never, KeelError<string, unknown>> => {
    if (expect === undefined) return err(toUnexpected(thrown));
    if (wrapsDefect(thrown)) throw thrown;
    const e = expect(thrown);
    if (e === undefined) throw thrown;
    return err(e);
  };
  let value: unknown;
  try {
    value = fn();
    if (!isThenable(value)) return ok(value);
  } catch (thrown) {
    return settle(thrown);
  }
  return Promise.resolve(value).then(ok, settle);
}
