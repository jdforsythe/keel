import type { Ctx } from "@keel/ctx";
import type { KeelError, Result, Schema } from "@keel/schema";

/**
 * A route loader declared with `loader(output, fn)` (k.server). `run` is called by the router or server.
 * `P` and `S` are what `fn` declares for `params` and `search` (`unknown` when unread); `manifest` requires
 * them to accept `Infer` of the route's `params` and `search` schemas.
 */
export interface Loader<T, P = unknown, S = unknown> {
  readonly kind: "keel.loader";
  readonly output: Schema<T>;
  run(args: { readonly params: P; readonly search: S }, ctx: Ctx): Promise<Result<T, KeelError<string, unknown>>>;
}
