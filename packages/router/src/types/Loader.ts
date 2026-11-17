import type { Ctx } from "@keel/ctx";
import type { KeelError, ObjectSchema, Result, Schema, Secret } from "@keel/schema";

/**
 * A route loader declared with `loader({ output, params?, search?, stores? }, fn)` (k.server). `run` is called by the
 * router or server with the absolute request `url`, the request's `caller`, its `bearer` (k.api Bearer; optional for a
 * direct caller) and its instance of the `stores` factory (k.server Server state; `undefined` without one). `params`/`search` are the declared schemas (absent when omitted);
 * `manifest` requires them to be the route's own (E1507) and `P`/`S` to accept `Infer` of the route's schemas.
 * A live loader (its `fn` an async generator) also has `live`, every yield until it returns or `signal` aborts; its
 * `run` is the first yield (k.server API).
 */
export interface Loader<T, P = unknown, S = unknown, St = unknown> {
  readonly kind: "keel.loader";
  readonly output: Schema<T>;
  readonly params?: ObjectSchema<P>;
  readonly search?: ObjectSchema<S>;
  readonly stores?: (ctx: Ctx) => St;
  run(
    args: {
      readonly params: P;
      readonly search: S;
      readonly url: string;
      readonly caller: string;
      readonly bearer?: Secret<string>;
      readonly stores: St;
    },
    ctx: Ctx,
  ): Promise<Result<T, KeelError<string, unknown>>>;
  live?(
    args: {
      readonly params: P;
      readonly search: S;
      readonly url: string;
      readonly caller: string;
      readonly bearer?: Secret<string>;
      readonly stores: St;
      readonly signal: AbortSignal;
    },
    ctx: Ctx,
  ): AsyncIterable<Result<T, KeelError<string, unknown>>>;
}
