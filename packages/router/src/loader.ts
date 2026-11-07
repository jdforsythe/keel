import type { Ctx } from "@keel/ctx";
import type { KeelError, ObjectSchema, Result, Schema } from "@keel/schema";
import type { Loader } from "./types/Loader.ts";

type Run<T, P, S> = (
  args: { readonly params: P; readonly search: S; readonly url: string },
  ctx: Ctx,
) => Promise<Result<T, KeelError<string, unknown>>>;

/**
 * Declare a route loader (k.server API, RFC 0027): `fn` gets `{ params, search, url }` and `ctx`, and returns a Result
 * whose `ok` value is encoded with `output`. `params`/`search` are `Infer` of the declared schemas (`unknown` when
 * omitted), which must be the referencing route's own values (`manifest` throws E1507); `fn` is never annotated.
 * `url` is the absolute request URL. The router runs it in-process in a client-only app.
 */
export function loader<T, P = unknown, S = unknown>(
  decl: { readonly output: Schema<T>; readonly params?: ObjectSchema<P>; readonly search?: ObjectSchema<S> },
  fn: Run<T, NoInfer<P>, NoInfer<S>>,
): Loader<T, P, S> {
  const { output, params, search } = decl;
  return Object.freeze({
    kind: "keel.loader",
    output,
    ...(params === undefined ? {} : { params }),
    ...(search === undefined ? {} : { search }),
    run: fn,
  });
}
