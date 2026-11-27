import type { KeelError } from "./KeelError.ts";
import type { Result } from "./Result.ts";
import { defect } from "./defect.ts";
import { err } from "./err.ts";
import { isKeelError } from "./internal/isKeelError.ts";
import { resultBrand } from "./internal/resultBrand.ts";
import { wrapsDefect } from "./internal/wrapsDefect.ts";
import { ok } from "./ok.ts";

type Failure = KeelError<string, unknown>;
/** A literal a callback returns stands for its primitive, as it would in a declared return type. */
type Widen<V> = V extends string ? string : V extends number ? number : V extends boolean ? boolean : V;
type ValueOf<T> = T extends { readonly ok: true; readonly value: infer U }
  ? U
  : T extends { readonly ok: false; readonly error: Failure }
    ? never
    : Widen<T>;
type ErrorOf<T> = T extends { readonly ok: false; readonly error: infer F extends Failure } ? F : never;
type Flat<T, E extends Failure> = Result<ValueOf<T>, E | ErrorOf<T>>;
type Settled<T, E extends Failure> = [T] extends [never]
  ? Result<never, E>
  : [T] extends [PromiseLike<infer U>]
    ? Promise<Flat<U, E>>
    : Flat<T, E>;

const isThenable = (x: unknown): boolean =>
  (typeof x === "object" || typeof x === "function") && x !== null && typeof Reflect.get(x, "then") === "function";

/** A keel `Result` (one `ok` or `err` made) is the call's own; any other value is its `ok`. */
const settled = (v: unknown): Result<unknown, Failure> =>
  typeof v === "object" && v !== null && Object.hasOwn(v, resultBrand) && isResult(v) ? v : ok(v);

function isResult(v: object): v is Result<unknown, Failure> {
  return (
    typeof v === "object" &&
    v !== null &&
    ((Reflect.get(v, "ok") === true && Object.hasOwn(v, "value")) ||
    (Reflect.get(v, "ok") === false && isKeelError(Reflect.get(v, "error"))))
  );
}

/**
 * The one catch (k.attempt). Runs `fn`: a value is `ok`, a keel `Result` it returns is the call's own (never nested),
 * a defect (or a value one is reachable from through `cause` and `errors` in at most 8 steps) is thrown on unseen, and
 * any other throw goes to `expect`, whose `KeelError` is the `err`; for `undefined` the thrown value goes on unchanged.
 * An async `fn` settles the same way in a promise. Called with one argument, it raises the defect E1452.
 */
export function attempt<T, E extends Failure>(fn: () => T, expect: (thrown: unknown) => E | undefined): Settled<T, E>;
export function attempt(
  fn: () => unknown,
  expect: (thrown: unknown) => Failure | undefined,
): Result<unknown, Failure> | Promise<Result<unknown, Failure>> {
  if (typeof expect !== "function") defect("attempt needs expect", "E1452");
  const settle = (thrown: unknown): Result<never, Failure> => {
    if (wrapsDefect(thrown)) throw thrown;
    const e = expect(thrown);
    if (e === undefined) throw thrown;
    return err(e);
  };
  let value: unknown;
  try {
    value = fn();
  } catch (thrown) {
    return settle(thrown);
  }
  if (!isThenable(value)) return settled(value);
  return Promise.resolve(value).then(settled, settle);
}
