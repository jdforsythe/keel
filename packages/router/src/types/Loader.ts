import type { Ctx } from "@keel/ctx";
import type { KeelError, ObjectSchema, Result, Schema } from "@keel/schema";

/**
 * A route loader declared with `loader({ output, params?, search? }, fn)` (k.server). `run` is called by the router
 * or server with the absolute request `url`. `params`/`search` are the declared schemas (absent when omitted);
 * `manifest` requires them to be the route's own (E1507) and `P`/`S` to accept `Infer` of the route's schemas.
 */
export interface Loader<T, P = unknown, S = unknown> {
  readonly kind: "keel.loader";
  readonly output: Schema<T>;
  readonly params?: ObjectSchema<P>;
  readonly search?: ObjectSchema<S>;
  run(
    args: { readonly params: P; readonly search: S; readonly url: string },
    ctx: Ctx,
  ): Promise<Result<T, KeelError<string, unknown>>>;
}
