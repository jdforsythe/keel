import type { Ctx } from "@keel/ctx";
import type { KeelError, Result, Schema } from "@keel/schema";

/** A route loader declared with `loader(output, fn)` (k.server). `run` is called by the router or server. */
export interface Loader<T, P = Readonly<Record<string, unknown>>, S = Readonly<Record<string, unknown>>> {
  readonly kind: "keel.loader";
  readonly output: Schema<T>;
  run(args: { readonly params: P; readonly search: S }, ctx: Ctx): Promise<Result<T, KeelError<string, unknown>>>;
}
