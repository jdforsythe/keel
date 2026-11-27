import { type KeelError, type Result, defect, err, ok } from "@keel/schema";
import { isKeelError, isResult } from "@keel/schema/internal";
import type { Ctx } from "./Ctx.ts";
import { ctxMeta } from "./internal/ctxMeta.ts";
import { report } from "./internal/report.ts";
import { supervisedBy } from "./internal/supervisedBy.ts";

type Failure = KeelError<string, unknown>;
type ValueOf<T> = T extends { readonly ok: true; readonly value: infer U }
  ? U
  : T extends { readonly ok: false; readonly error: Failure }
    ? never
    : T;
type ErrorOf<T> = T extends { readonly ok: false; readonly error: infer F extends Failure } ? F : never;
type Flat<T, E extends Failure> = Result<ValueOf<T>, E | ErrorOf<T>>;
type Settled<T, E extends Failure> = [T] extends [PromiseLike<infer U>] ? Promise<Flat<U, E>> : Flat<T, E>;

const isThenable = (x: unknown): boolean =>
  (typeof x === "object" || typeof x === "function") && x !== null && typeof Reflect.get(x, "then") === "function";

/** A keel `Result` `fn` returned is the call's own; any other value is its `ok`. */
const settled = (v: unknown): Result<unknown, Failure> => (isResult(v) ? v : ok(v));

/** Whether `failed` is a `KeelError`; a value whose inspection throws (a `Proxy`) is none. */
const isFailure = (failed: unknown): boolean => {
  try {
    return isKeelError(failed);
  } catch {
    return false;
  }
};

/** Report `thrown` once (k.supervise Report): the server's record, then one `error` event; a throw of either is dropped. */
function reported(ctx: Ctx, id: string, thrown: unknown): void {
  try {
    (supervisedBy.get(ctx) ?? supervisedBy.get(ctxMeta.get(ctx)?.root ?? ctx))?.(id, thrown);
  } catch {
    // The report never replaces the result (k.supervise).
  }
  try {
    report(ctx, {
      kind: "error",
      error: { code: "keel.unexpected", message: "keel.unexpected", data: { at: id } },
    });
  } catch {
    // As above.
  }
}

/**
 * Run code the caller does not own and outlive its throws (k.supervise). `fn` returning `v` is `ok(v)`, a keel
 * `Result` it returns is the call's own; every value it throws or rejects with, a defect among them, is reported
 * once and gives `err(failed)`, as is a returned value whose inspection throws. It never throws or rejects for a
 * throw of `fn`, and sets no time: each supervisor bounds its work. `failed` is made before `fn` runs, so nothing of a
 * thrown value reaches the caller; one that is no `KeelError` is the defect E1458 before `fn` runs. A kernel package
 * and a library's file may call it (R1018); app code may not (E1461).
 */
export function supervise<T, E extends Failure>(ctx: Ctx, id: string, fn: () => T, failed: E): Settled<T, E>;
export function supervise(
  ctx: Ctx,
  id: string,
  fn: () => unknown,
  failed: Failure,
): Result<unknown, Failure> | Promise<Result<unknown, Failure>> {
  if (!isFailure(failed)) defect("supervise takes a KeelError as failed", { code: "E1458" });
  // Made before `fn` runs, so a `failed` read again later cannot turn a supervised throw into a throw of the call.
  const failure = err(failed);
  const threw = (thrown: unknown): Result<never, Failure> => {
    reported(ctx, id, thrown);
    return failure;
  };
  let value: unknown;
  try {
    value = fn();
  } catch (thrown) {
    return threw(thrown);
  }
  let thenable: boolean;
  try {
    thenable = isThenable(value);
  } catch (thrown) {
    return threw(thrown);
  }
  if (!thenable) {
    try {
      return settled(value);
    } catch (thrown) {
      return threw(thrown);
    }
  }
  return Promise.resolve(value).then(settled, threw).then(undefined, threw);
}
