import type { Ctx } from "@keel/ctx";
import type { KeelError, Result, Schema } from "@keel/schema";
import type { Loader } from "./types/Loader.ts";

/**
 * Declare a route loader (k.server): `fn` gets parsed `params` and `search` and `ctx`, and returns a Result
 * whose `ok` value is encoded with `output`. The router runs it in-process in a client-only app. `fn` types
 * `params`/`search` as `Infer` of the route's schemas; a shape they do not fit fails at `manifest`.
 */
export function loader<T, P = unknown, S = unknown>(
  output: Schema<T>,
  fn: (args: { readonly params: P; readonly search: S }, ctx: Ctx) => Promise<Result<T, KeelError<string, unknown>>>,
): Loader<T, P, S> {
  return Object.freeze({ kind: "keel.loader", output, run: fn });
}
